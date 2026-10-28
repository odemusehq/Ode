import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { z } from "zod";
import type { DeviceCommand, LiveConnections } from "../shared/live";
import type { CopyResult } from "../shared/api";
import { ResultKind, type UiEvent } from "../shared/events";
import { VersionAuthor, type RestoreResult, type Version, type VersionDetail, type VersionListItem } from "../shared/versions";
import type { LyricsStore } from "../mneme/lyrics-store";
import type { SongStore, SongVersions } from "../mneme/song-store";
import { SessionBusyError, type OdeSession } from "../harness/session";
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

/** Written into a copy of the project: the version the copy goes back to when it is first opened. */
const RESTORE_ON_OPEN = "restore-on-open.json";
const RestoreMarkerSchema = z.object({ versionId: z.string() });

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
const SAVE_FIRST = "Save the Set first";
/** A put-back that failed part-way is saved as Ode's version, so Undo goes back to before it. */
const STOPPED_PART_WAY = "Restore stopped part-way";
/** What Ode is asked for Why?; the hidden context says which change and how to answer. */
const WHY_REQUEST = "Why?";

/** Characters that can't be part of a folder name on macOS or Windows. */
const UNSAFE_IN_FOLDER_NAMES = /[/\\:*?"<>|]/g;

/** What History, Undo, Again and Why? do with the versions of the whole Set. */
export class VersionActions {
  private openingCopy = false;
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
   * versionId null: the newest version (the Undo control on the Ode device).
   */
  async undo(versionId: string | null): Promise<RestoreResult> {
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
   * versionId null: the newest version (the Again control on the Ode device).
   */
  async again(versionId: string | null): Promise<void> {
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

  /** Undo or Again pressed on the Ode device (or the key or pad mapped to it in Live): on the newest change by Ode. */
  async command(command: DeviceCommand): Promise<void> {
    try {
      if (command.name === "again") {
        await this.again(null);
        return;
      }
      const result = await this.undo(null);
      if (!result.restored) this.deps.emit({ type: "error", message: result.skipped.join(" ") });
    } catch (error) {
      this.deps.emit({ type: "error", message: VersionActions.messageOf(error) });
    }
  }

  /**
   * Copies the project folder next to itself as "<folder> (<version name, or date and time>)" and marks
   * the version, so the copy goes back to it when it is opened in Live.
   */
  async copy(id: string): Promise<CopyResult> {
    if (!this.deps.song.projectDir) throw new RefusedError(SAVE_FIRST);
    return this.copyAt(await this.history.get(id));
  }

  /** Saves the musician's hand edits, then copies the project as it is now: the copy opens at the newest version. */
  async copyNow(): Promise<CopyResult> {
    if (!this.deps.song.projectDir) throw new RefusedError(SAVE_FIRST);
    return this.session.exclusive(async () => {
      await this.deps.recorder.handEdits();
      const newest = (await this.history.list()).at(-1);
      if (!newest) throw new RefusedError("There is no version of the Set to copy yet.");
      return this.copyAt(newest);
    });
  }

  /**
   * A copy made from History goes back to its version the first time it is open with the extension and the
   * Ode device connected; the mark is deleted afterwards. Call it when a Set opens and when Live connects.
   */
  async restoreOnOpen(): Promise<void> {
    const { extension, device } = this.deps.live;
    if (this.openingCopy || !extension.connected() || !device.connected()) return;
    const file = join(this.deps.song.dataDir, RESTORE_ON_OPEN);
    const marker = await VersionActions.readMarker(file);
    if (!marker) return;
    this.openingCopy = true;
    try {
      const result = await this.restoreTo(marker.versionId, (version) => `This copy is back at the version from ${VersionActions.clock(version.time)}`);
      await rm(file, { force: true });
      if (!result.restored) this.deps.emit({ type: "error", message: `This copy couldn't go back to its version: ${result.skipped.join(" ")}` });
    } catch (error) {
      // Ode is working or Live dropped: the mark stays, and the next connection tries again.
      if (error instanceof SessionBusyError || error instanceof SetReadError) return;
      await rm(file, { force: true });
      this.deps.emit({ type: "error", message: `This copy couldn't go back to its version: ${VersionActions.messageOf(error)}` });
    } finally {
      this.openingCopy = false;
    }
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

  private async copyAt(version: Version): Promise<CopyResult> {
    const project = this.deps.song.projectDir;
    if (!project) throw new RefusedError(SAVE_FIRST);
    const destination = await VersionActions.freeFolder(join(dirname(project), `${basename(project)} (${VersionActions.copyName(version)})`));
    await cp(project, destination, { recursive: true, errorOnExist: true, force: false });
    const dataDir = join(destination, relative(project, this.deps.song.dataDir));
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, RESTORE_ON_OPEN), `${JSON.stringify({ versionId: version.id }, null, 2)}\n`, "utf8");
    return { path: destination };
  }

  private async refreshSuggestions(): Promise<void> {
    await this.deps.selection.refresh().catch(() => undefined);
  }

  /**
   * The change an action applies to: the newest version, made by Ode and named by versionId (null: whichever it is),
   * with the version before it. Otherwise RefusedError saying why, from the history: the musician changed the Set
   * since a change by Ode, Ode changed it again since, or there is no change by Ode.
   */
  private static changeToActOn(versions: Version[], versionId: string | null, action: OdeAction): { latest: Version; previous: Version } {
    const latest = versions.at(-1);
    const previous = versions.at(-2);
    if (latest?.author === VersionAuthor.Ode && previous) {
      if (versionId === null || latest.id === versionId) return { latest, previous };
      throw new RefusedError(NEWER_CHANGE);
    }
    const editedSince = latest?.author === VersionAuthor.Musician && versions.some((version) => version.author === VersionAuthor.Ode);
    throw new RefusedError(editedSince ? REFUSALS[action].editedSince : REFUSALS[action].nothing);
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static notRestored(skipped: string[]): string {
    return skipped.length > 0 ? ` · not restored: ${skipped.join(", ")}` : "";
  }

  private static clock(time: string): string {
    return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  /** The version's name, or its date and time ("2026-10-28 22.38"), made safe for a folder name. */
  private static copyName(version: Version): string {
    const named = version.name?.replace(UNSAFE_IN_FOLDER_NAMES, "-").trim();
    if (named) return named;
    const time = new Date(version.time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}.${pad(time.getMinutes())}`;
  }

  /** The folder, or the same name followed by 2, 3 … when it is taken. */
  private static async freeFolder(path: string): Promise<string> {
    const taken = (candidate: string) => stat(candidate).then(() => true, () => false);
    if (!(await taken(path))) return path;
    let number = 2;
    while (await taken(`${path} ${number}`)) number += 1;
    return `${path} ${number}`;
  }

  private static async readMarker(file: string): Promise<z.infer<typeof RestoreMarkerSchema> | null> {
    try {
      return RestoreMarkerSchema.parse(JSON.parse(await readFile(file, "utf8")));
    } catch {
      return null;
    }
  }
}
