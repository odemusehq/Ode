import type { LiveConnections } from "../shared/live";
import { ResultKind, type UiEvent } from "../shared/events";
import { VersionAuthor, type RestoreResult, type Version, type VersionDetail, type VersionListItem } from "../shared/versions";
import type { LyricsStore } from "../mneme/lyrics-store";
import type { SongStore, SongVersions } from "../mneme/song-store";
import type { OdeSession } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import { RestoreRunner, type PutBack } from "./restore-runner";
import type { SelectionState } from "./selection";
import { SetReadError } from "./snapshot-reader";
import { VersionRecorder } from "./version-recorder";

/** What the musician asked can't be done now; the message says why and what to do. */
export class RefusedError extends Error {}

export interface VersionActionsDeps {
  live: LiveConnections;
  song: SongStore;
  lyrics: Pick<LyricsStore, "replace">;
  versions: SongVersions;
  recorder: VersionRecorder;
  sessions: SessionManager;
  selection: Pick<SelectionState, "refresh">;
  emit: (event: UiEvent) => void;
}

/** The actions on a change by Ode; each applies only while that change is the newest version. */
enum OdeAction {
  Undo = "undo",
  Again = "again",
  Why = "why",
}

/** Why an action can't be done, as the history shows it: the musician changed the Set since, or Ode changed nothing. */
const REFUSALS: Record<OdeAction, { editedSince: string; nothing: string }> = {
  [OdeAction.Undo]: {
    editedSince: "You have changed the Set since Ode's last change. To go back further, restore a version in History.",
    nothing: "There is no change by Ode to undo.",
  },
  [OdeAction.Again]: {
    editedSince: "You have changed the Set since Ode's last change, so trying it again would undo your edits.",
    nothing: "There is no change by Ode to try again.",
  },
  [OdeAction.Why]: {
    editedSince: "You have changed the Set since Ode's last change.",
    nothing: "There is no change by Ode to explain.",
  },
};
/** The change named is Ode's, but not its newest. */
const NEWER_CHANGE = "Ode has made another change since.";
/** A put-back that failed part-way is saved as Ode's version, so Undo goes back to before it. */
const STOPPED_PART_WAY = "Restore stopped part-way";
/** What Ode is asked for Why?; the hidden context says which change and how to answer. */
const WHY_REQUEST = "Why?";

/** What History, Undo, Again and Why? do with the versions of the whole Set. */
export class VersionActions {
  private readonly runner: RestoreRunner;

  constructor(private readonly deps: VersionActionsDeps) {
    this.runner = new RestoreRunner(deps.live, deps.song, deps.lyrics);
  }

  private get history() {
    return this.deps.versions.history;
  }

  private get session(): OdeSession {
    return this.deps.sessions.current;
  }

  /** The History list, newest first. */
  items(): Promise<VersionListItem[]> {
    return this.history.items();
  }

  /**
   * Saves the musician's hand edits as a version now (the window asks when it gets the focus), so History is current.
   * Returns the new version, or null when nothing changed, Ode is working or the Set can't be read.
   */
  async check(): Promise<VersionListItem | null> {
    if (this.session.isBusy) return null;
    try {
      const recorded = await this.deps.recorder.handEdits();
      return recorded.version ? await this.deps.recorder.listItem(recorded.version) : null;
    } catch (error) {
      if (error instanceof SetReadError) return null;
      throw error;
    }
  }

  /** Throws VersionNotFoundError for a version that isn't in this song's history. */
  detail(id: string): Promise<VersionDetail> {
    return this.history.detail(id);
  }

  name(id: string, name: string): Promise<VersionListItem> {
    return this.history.name(id, name);
  }

  /**
   * Goes back to a version the musician confirmed: saves their hand edits, puts the Set back from how it
   * is now, then deletes the versions after it. Throws when Ode is working or the Set can't be read.
   */
  restore(id: string): Promise<RestoreResult> {
    return this.restoreTo(id, (version) => `Restored the version from ${VersionActions.clock(version.time)}`);
  }

  /**
   * Back to the version before that change by Ode, without asking. The hand edits are saved first; RefusedError
   * (no result line) when the change isn't the newest version any more or Ode didn't make it.
   */
  async undo(versionId: string): Promise<RestoreResult> {
    const result = await this.session.exclusive(async () => {
      const recorded = await this.deps.recorder.handEdits();
      const { latest, previous } = VersionActions.changeToActOn(await this.history.list(), versionId, OdeAction.Undo);
      this.deps.emit({ type: "progress", text: `Undoing: ${latest.summary}` });
      const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(previous.id));
      if (!outcome.complete) return this.stoppedPartWay(outcome);
      await this.history.truncateAfter(previous.id);
      this.deps.emit({ type: "versions-truncated", afterId: previous.id });
      this.deps.emit({ type: "result", text: `Undone: ${latest.summary}${VersionActions.notRestored(outcome.skipped)}`, versionId: null, kind: ResultKind.Undo });
      return { restored: true, skipped: outcome.skipped };
    });
    await this.refreshSuggestions();
    return result;
  }

  /**
   * Another take of that change by Ode: puts the Set back to the version before it (keeping the history),
   * then runs the same request again. The put-back isn't saved as hand edits, so Ode's next version
   * shows the first take turning into the second. Stop pressed while the Set is put back cancels the retake.
   */
  async again(versionId: string): Promise<void> {
    await this.session.exclusive(async (stopped) => {
      const recorded = await this.deps.recorder.handEdits();
      const { latest, previous } = VersionActions.changeToActOn(await this.history.list(), versionId, OdeAction.Again);
      if (!latest.request) throw new RefusedError("Ode's last change doesn't say what was asked, so it can't be tried again.");
      this.deps.emit({ type: "progress", text: "Going back to before the last take" });
      const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(previous.id));
      if (!outcome.complete) {
        await this.stoppedPartWay(outcome);
        throw new RefusedError(outcome.skipped.join(" "));
      }
      if (stopped.aborted) {
        await this.keepStoppedPutBack(latest.request);
        return;
      }
      if (outcome.skipped.length > 0) this.deps.emit({ type: "progress", text: `Not put back: ${outcome.skipped.join(", ")}` });
      this.session.sendFirst({ text: latest.request, again: true });
    });
  }

  /**
   * Why? about that change by Ode: Ode answers in two or three sentences and changes nothing (the answer arrives as an
   * "answer" event). RefusedError when the change isn't the newest version any more.
   */
  async why(versionId: string): Promise<void> {
    VersionActions.changeToActOn(await this.history.list(), versionId, OdeAction.Why);
    void this.session.send({ text: WHY_REQUEST, reply: { versionId } });
  }

  private async restoreTo(id: string, resultLine: (version: Version) => string): Promise<RestoreResult> {
    const result = await this.session.exclusive(async () => {
      const version = await this.history.get(id);
      this.deps.emit({ type: "progress", text: `Going back to the version from ${VersionActions.clock(version.time)}` });
      const recorded = await this.deps.recorder.handEdits();
      const outcome = await this.runner.putBack(recorded.snapshot, await this.history.snapshotAt(id));
      if (!outcome.complete) return this.stoppedPartWay(outcome);
      await this.history.truncateAfter(id);
      this.deps.emit({ type: "versions-truncated", afterId: id });
      this.deps.emit({ type: "result", text: `${resultLine(version)}${VersionActions.notRestored(outcome.skipped)}`, versionId: null, kind: ResultKind.Restore });
      return { restored: true, skipped: outcome.skipped };
    });
    await this.refreshSuggestions();
    return result;
  }

  /**
   * A put-back that failed part-way: the Set as it is now is saved as Ode's version "Restore stopped part-way: …",
   * so Undo goes back to before it. Nothing is saved when the Set can't be read any more.
   */
  private async stoppedPartWay(outcome: PutBack): Promise<RestoreResult> {
    const recorded = await this.deps.recorder.odeCutShort(STOPPED_PART_WAY).catch(() => null);
    const version = recorded?.version;
    if (version) this.deps.emit({ type: "result", text: version.summary, versionId: version.id, kind: ResultKind.Stopped });
    return { restored: false, skipped: outcome.skipped };
  }

  /** Stop pressed while the Set was put back for Again: the put-back is saved as Ode's version, so Undo brings the take back. */
  private async keepStoppedPutBack(request: string): Promise<void> {
    const recorded = await this.deps.recorder.odeCutShort(VersionRecorder.STOPPED, request);
    const version = recorded.version;
    if (version) this.deps.emit({ type: "result", text: version.summary, versionId: version.id, kind: ResultKind.Stopped });
    await this.refreshSuggestions();
  }

  private async refreshSuggestions(): Promise<void> {
    await this.deps.selection.refresh().catch(() => undefined);
  }

  /**
   * The change an action applies to: the newest version, made by Ode and named by versionId, with the version before it. Otherwise RefusedError saying why, from the history: the musician changed the Set
   * since a change by Ode, Ode changed it again since, or there is no change by Ode.
   */
  private static changeToActOn(versions: Version[], versionId: string, action: OdeAction): { latest: Version; previous: Version } {
    const latest = versions.at(-1);
    const previous = versions.at(-2);
    if (latest?.author === VersionAuthor.Ode && previous) {
      if (latest.id === versionId) return { latest, previous };
      throw new RefusedError(NEWER_CHANGE);
    }
    const editedSince = latest?.author === VersionAuthor.Musician && versions.some((version) => version.author === VersionAuthor.Ode);
    throw new RefusedError(editedSince ? REFUSALS[action].editedSince : REFUSALS[action].nothing);
  }

  private static notRestored(skipped: string[]): string {
    return skipped.length > 0 ? ` · not restored: ${skipped.join(", ")}` : "";
  }

  private static clock(time: string): string {
    return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}
