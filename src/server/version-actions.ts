import { SetDiff } from "../mneme/set-diff";
import type { SetSnapshot } from "../shared/set-snapshot";
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
import type { MutationReceipt, VerifiedMutationReceipt } from "../shared/mutation-receipt";
import type { ExtensionOpResults } from "../shared/live-ops";
import { markPendingObservation, pendingObservationFile } from "../mneme/pending-observation";

/** The musician's request is refused for now; the message says why and what to do. */
export class RefusedError extends Error {}

export interface VersionActionsDeps {
  live: LiveConnections;
  song: SongStore;
  lyrics: Pick<LyricsStore, "replace"> & Partial<Pick<LyricsStore, "revert">>;
  versions: SongVersions;
  recorder: VersionRecorder;
  sessions: SessionManager;
  selection: Pick<SelectionState, "refresh">;
  emit: (event: UiEvent) => void;
}

/** Questions about a result; editing recovery uses scoped writer receipts. */
enum OdeAction {
  Undo = "undo",
  Again = "again",
  Why = "why",
}

/** Why an action is refused, as the history shows it: the musician changed the Set since, or Ode has yet to make a change. */
const REFUSALS: Record<OdeAction, { editedSince: string; nothing: string }> = {
  [OdeAction.Undo]: {
    editedSince: "You have changed the Set since Ode's last change. To go back further, restore a version in History.",
    nothing: "Ode has yet to make a change to undo.",
  },
  [OdeAction.Again]: {
    editedSince: "You have changed the Set since Ode's last change, so trying it again would undo your edits.",
    nothing: "Ode has yet to make a change to try again.",
  },
  [OdeAction.Why]: {
    editedSince: "You have changed the Set since Ode's last change.",
    nothing: "Ode has yet to make a change to explain.",
  },
};
/** The change named is Ode's, and Ode has made a newer one since. */
const NEWER_CHANGE = "Ode has made another change since.";
/** A put-back that failed part-way is saved as Ode's version, so Undo goes back to before it. */
const STOPPED_PART_WAY = "Restore stopped part-way";
/** What Ode is asked for Why?; the hidden context says which change and how to answer. */
const WHY_REQUEST = "Why?";

/** History restores observed state; Undo and Again invert only writes with guarded scoped receipts. */
export class VersionActions {
  private readonly runner: RestoreRunner;

  constructor(private readonly deps: VersionActionsDeps) {
    this.runner = new RestoreRunner(deps.live, deps.song, deps.lyrics, () => deps.recorder.readCurrent());
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
   * Returns the new version, or null when the Set stayed the same, Ode is working or the Set is unreadable.
   */
  async check(): Promise<VersionListItem | null> {
    if (this.session.isBusy) return null;
    try {
      await this.deps.recorder.recoverPending(this.deps.song.dataDir);
      const recorded = await this.deps.recorder.handEdits();
      return recorded.version ? await this.deps.recorder.listItem(recorded.version) : null;
    } catch (error) {
      if (error instanceof SetReadError) return null;
      throw error;
    }
  }

  /** Throws VersionNotFoundError for a version missing from this song's history. */
  detail(id: string): Promise<VersionDetail> {
    return this.history.detail(id);
  }

  name(id: string, name: string): Promise<VersionListItem> {
    return this.history.name(id, name);
  }

  /**
   * Goes back to a version the musician confirmed: saves their hand edits, puts the Set back from how it
   * is now, keeps the later recovery versions and records the actual restored state. Throws when Ode is working or the Set is unreadable.
   */
  restore(id: string): Promise<RestoreResult> {
    return this.restoreTo(id, (version) => `Restored the version from ${VersionActions.clock(version.time)}`);
  }

  /**
   * Undo only this change's recorded writes. Later hand edits are saved and preserved by writer guards/merges;
   * versions without scoped receipts are refused rather than rolling back the whole observed Set.
   */
  async undo(versionId: string): Promise<RestoreResult> {
    const result = await this.session.exclusive(async () => {
      await this.deps.recorder.recoverPending(this.deps.song.dataDir);
      await this.deps.recorder.handEdits();
      const latest = await this.scopedChange(versionId);
      this.deps.emit({ type: "progress", text: `Undoing: ${latest.summary}` });
      return this.undoScoped(latest);
    });
    await this.refreshSuggestions();
    return result;
  }

  /**
   * Another take after a successful scoped inverse. Other edits stay in place; a conflict or Stop cancels the retake.
   */
  async again(versionId: string): Promise<void> {
    await this.session.exclusive(async (stopped) => {
      await this.deps.recorder.recoverPending(this.deps.song.dataDir);
      await this.deps.recorder.handEdits();
      const latest = await this.scopedChange(versionId);
      if (!latest.request) throw new RefusedError("Again needs the request behind Ode's last change, and this change was saved without it.");
      const outcome = await this.undoScoped(latest);
      if (!outcome.restored) throw new RefusedError(outcome.skipped.join(" "));
      if (stopped.aborted) return;
      this.session.sendFirst({ text: latest.request, again: true });
    });
  }

  /** Scope, identity and current-value guards replace whole-Set rollback, including after later hand edits. */
  private async scopedChange(id: string): Promise<Version> {
    const version = await this.history.get(id);
    if (!version.recovery?.receipts.length || version.recovery.used || version.recovery.unverified || version.recovery.receipts.some((receipt) => receipt.kind === "unverified")) {
      throw new RefusedError("This change includes operations without verified scoped recovery. Use History to review and explicitly restore a version; automatic Undo would risk your hand edits.");
    }
    return version;
  }

  private async undoScoped(version: Version): Promise<RestoreResult> {
    await this.history.claimRecovery(version.id);
    this.deps.emit({ type: "version", version: this.deps.recorder.listItem(await this.history.get(version.id)) });
    await markPendingObservation(this.deps.song.dataDir, [`Undo ${version.id}`]);
    const applied: MutationReceipt[] = [];
    const skipped: string[] = [];
    for (const receipt of [...version.recovery!.receipts].reverse() as VerifiedMutationReceipt[]) {
      try {
        if (receipt.kind === "midi-notes") {
          const capability = await this.deps.live.extension.call<ExtensionOpResults["midi_clip_get_notes"]>("midi_clip_get_notes", { clip: receipt.clip, recoveryToken: receipt.token });
          if (!capability.guardedRecovery) throw new Error("The installed extension does not support guarded MIDI recovery; its notes were kept.");
          const result = await this.deps.live.extension.call<ExtensionOpResults["midi_clip_set_notes"]>("midi_clip_set_notes", {
            clip: receipt.clip, notes: receipt.before, expected: { token: receipt.token, notes: receipt.after },
          });
          if (!result.__odeReceipts?.length) throw new Error("The installed extension did not return a guarded MIDI recovery receipt.");
          applied.push(...result.__odeReceipts);
        } else if (receipt.kind === "lyrics") {
          if (!this.deps.lyrics.revert) throw new Error("Scoped lyric recovery is unavailable.");
          const result = await this.deps.lyrics.revert(receipt);
          applied.push(result.receipt);
          if (result.conflicts.length) skipped.push(`The musician's later lyric edits were kept on lines ${result.conflicts.join(", ")}.`);
        } else {
          const result = await this.deps.song.restoreFields(receipt.after, receipt.before, receipt.songId, receipt.afterAbsent, receipt.beforeAbsent);
          applied.push(...result.__odeReceipts);
        }
      } catch (error) {
        skipped.push(error instanceof Error ? error.message : String(error));
      }
      if (skipped.length) break;
    }
    const text = skipped.length ? `Undo kept your later edits: ${skipped.join(" ")}` : `Undone: ${version.summary}`;
    const recorded = await this.deps.recorder.odeChange(text, `Undo ${version.id}`, applied);
    await pendingObservationFile(this.deps.song.dataDir).write(null);
    this.deps.emit({ type: "result", text, versionId: recorded.version?.id ?? null, kind: skipped.length ? ResultKind.Stopped : ResultKind.Undo });
    return { restored: skipped.length === 0, skipped };
  }

  /**
   * Why? about that change by Ode: Ode answers in two or three sentences and leaves the Set as it is (the answer arrives
   * as an "answer" event). RefusedError when a newer version has come since.
   */
  async why(versionId: string): Promise<void> {
    await this.changeToActOn(versionId, OdeAction.Why);
    void this.session.send({ text: WHY_REQUEST, reply: { versionId } });
  }

  private async restoreTo(id: string, resultLine: (version: Version) => string): Promise<RestoreResult> {
    const result = await this.session.exclusive(async () => {
      const version = await this.history.get(id);
      this.deps.emit({ type: "progress", text: `Restoring the version from ${VersionActions.clock(version.time)}. Leave the Set and lyrics alone while it applies.` });
      await this.deps.recorder.recoverPending(this.deps.song.dataDir);
      const recorded = await this.deps.recorder.handEdits();
      const target = await this.history.snapshotAt(id);
      await markPendingObservation(this.deps.song.dataDir, [`Restore ${id}`]);
      let outcome: PutBack;
      try { outcome = await this.runner.putBack(recorded.snapshot, target); }
      catch (error) { return this.stoppedPartWay({ complete: false, skipped: [error instanceof Error ? error.message : String(error)] }); }
      if (!outcome.complete || outcome.skipped.length > 0) return this.stoppedPartWay(outcome);
      const verified = await this.verifyRestore(target, resultLine(version), `Restore ${id}`);
      if (!verified.complete) return { restored: false, skipped: verified.skipped };
      this.deps.emit({ type: "result", text: `${resultLine(version)}${VersionActions.notRestored(outcome.skipped)}`, versionId: null, kind: ResultKind.Restore });
      return { restored: true, skipped: outcome.skipped };
    });
    await this.refreshSuggestions();
    return result;
  }

  /** Verify the supported snapshot fields and keep the actual outcome as a new recovery version. */
  private async verifyRestore(target: SetSnapshot, summary: string, request: string): Promise<PutBack> {
    const actual = await this.deps.recorder.odeChange(summary, request);
    await pendingObservationFile(this.deps.song.dataDir).write(null);
    const expected = structuredClone(target);
    // Artist/song settings intentionally survive restoring musical material.
    if (expected.sheet && actual.snapshot.sheet) expected.sheet.settings = actual.snapshot.sheet.settings;
    const remaining = SetDiff.between(actual.snapshot, expected);
    if (remaining.length === 0) return { complete: true, skipped: [] };
    const skipped = remaining.map((change) => change.label);
    this.deps.emit({ type: "error", message: `The restore did not reach the requested state: ${skipped.join("; ")}. Recovery versions are retained.` });
    return { complete: false, skipped };
  }

  /**
   * A put-back that failed part-way: the Set as it is now is saved as Ode's version "Restore stopped part-way: …",
   * so Undo goes back to before it. When the Set has become unreadable, the history stays as it is.
   */
  private async stoppedPartWay(outcome: PutBack): Promise<RestoreResult> {
    const recorded = await this.deps.recorder.odeCutShort(STOPPED_PART_WAY).catch(() => null);
    if (recorded) await pendingObservationFile(this.deps.song.dataDir).write(null);
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
   * since a change by Ode, Ode changed it again since, or Ode has yet to make a change.
   */
  private async changeToActOn(versionId: string, action: OdeAction): Promise<{ latest: Version; previous: Version }> {
    const recent = await this.history.tail(2);
    const latest = recent.at(-1);
    const previous = recent.length === 2 ? recent[0] : undefined;
    if ((latest?.author === VersionAuthor.Ode || latest?.author === VersionAuthor.Observed && latest.recovery) && previous) {
      if (latest.id === versionId) return { latest, previous };
      throw new RefusedError(NEWER_CHANGE);
    }
    const editedSince = latest?.author === VersionAuthor.Musician && (await this.history.latestBy(VersionAuthor.Ode)) !== null;
    throw new RefusedError(editedSince ? REFUSALS[action].editedSince : REFUSALS[action].nothing);
  }

  private static notRestored(skipped: string[]): string {
    return skipped.length > 0 ? ` · skipped: ${skipped.join(", ")}` : "";
  }

  private static clock(time: string): string {
    return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}
