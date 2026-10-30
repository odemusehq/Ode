import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor, type SetChange, type Version, type VersionListItem } from "../shared/versions";
import { SetDiff } from "../mneme/set-diff";
import type { SongVersions } from "../mneme/song-store";
import { VersionHistory } from "../mneme/version-history";
import type { SnapshotReader } from "./snapshot-reader";
import type { MutationReceipt, RecoveryReceipt } from "../shared/mutation-receipt";
import { SetLookup } from "./set-lookup";
import { pendingObservationFile } from "../mneme/pending-observation";

export interface RecordedVersion {
  /** The Set as it was read for this version. */
  snapshot: SetSnapshot;
  /** The saved version, or null when the Set stayed the same. */
  version: Version | null;
  /** What changed since the previous version (empty for the first version). */
  changes: SetChange[];
}

/**
 * Saves versions of the whole Set: what the musician changed by hand, and what Ode changed.
 * One at a time, so each version is read and compared after the one before it.
 */
export class VersionRecorder {
  /** How a version saved after the musician pressed Stop begins: "Stopped: 3 edits on Bass". */
  static readonly STOPPED = "Stopped";
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly reader: SnapshotReader,
    private readonly versions: SongVersions,
    private readonly emit: (event: UiEvent) => void,
  ) {}

  /** Reads the Set and saves what the musician changed since the last version, as "You · 12 edits on Drums and Pad". */
  handEdits(): Promise<RecordedVersion> {
    return this.enqueue(async () => {
      const snapshot = await this.reader.read();
      return this.record(snapshot, VersionAuthor.Musician, (changes) => `You · ${SetDiff.summary(changes)}`);
    });
  }

  /** Reads the Set and saves what Ode changed for a request; the summary is Ode's result line. */
  odeChange(resultLine: string, request: string, receipts: readonly MutationReceipt[] = []): Promise<RecordedVersion> {
    return this.enqueue(async () => {
      const snapshot = await this.reader.read();
      return this.recordWork(snapshot, (changes) => resultLine || SetDiff.summary(changes), request, receipts);
    });
  }

  /**
   * Reads the Set and saves what Ode changed before it was cut short, as "<what>: 3 edits on Bass" (for example
   * "Stopped" or "Restore stopped part-way"), so Undo can go back to before it.
   */
  odeCutShort(what: string, request?: string, receipts: readonly MutationReceipt[] = []): Promise<RecordedVersion> {
    return this.enqueue(async () => {
      const snapshot = await this.reader.read();
      return this.recordWork(snapshot, (changes) => `${what}: ${SetDiff.summary(changes)}`, request, receipts);
    });
  }

  /** An observation for guards, without inventing a version author. */
  readCurrent(): Promise<SetSnapshot> { return this.reader.read(); }

  /** Retry a durable uncertain interval before anything labels later drift as the musician's. */
  async recoverPending(dir: string): Promise<void> {
    const file = pendingObservationFile(dir);
    const pending = await file.read();
    if (!pending) return;
    await this.odeCutShort("Interrupted work observed", pending.requests.join("\n"), [{
      kind: "unverified", tool: "interrupted request or recovery", reason: `Work issued before ${pending.at} did not have a recorded outcome; manual edits may share this interval.`,
    }]);
    await file.write(null);
  }

  private async recordWork(snapshot: SetSnapshot, summarize: (changes: SetChange[]) => string, request: string | undefined, receipts: readonly MutationReceipt[]): Promise<RecordedVersion> {
    const previous = await this.versions.history.latest();
    const expected = previous ? structuredClone(previous) : null;
    let owned = receipts.length > 0 && receipts.every((receipt) => receipt.kind !== "unverified");
    if (expected) for (const receipt of receipts) {
      if (receipt.kind === "midi-notes") {
        const found = new SetLookup(expected).clip(receipt.clip);
        if (found) {
          if (JSON.stringify(found.clip.notes) !== JSON.stringify(receipt.before)) owned = false;
          found.clip.notes = structuredClone(receipt.after);
        }
        else owned = false;
      } else if (receipt.kind === "lyrics") {
        if (expected.sheet) {
          if (expected.sheet.lyrics !== receipt.before) owned = false;
          expected.sheet.lyrics = receipt.after;
        }
        else owned = false;
      } else if (receipt.kind === "sheet-fields") {
        if (expected.sheet) {
          const fields = [...new Set([...Object.keys(receipt.before), ...(receipt.beforeAbsent ?? [])])] as (keyof typeof expected.sheet)[];
          for (const field of fields) if (JSON.stringify(expected.sheet[field]) !== JSON.stringify(receipt.before[field])) owned = false;
          Object.assign(expected.sheet, structuredClone(receipt.after));
          for (const field of receipt.afterAbsent ?? []) delete expected.sheet[field];
        }
        else owned = false;
      }
    }
    if (!expected || SetDiff.between(expected, snapshot).length > 0) owned = false;
    const recovery: RecoveryReceipt = { receipts: structuredClone([...receipts]), unverified: receipts.length === 0 || receipts.some((receipt) => receipt.kind === "unverified") };
    return this.record(snapshot, owned ? VersionAuthor.Ode : VersionAuthor.Observed, summarize, request, recovery);
  }

  /**
   * Runs the task once every version waiting to be saved is saved, and before the next one starts. Switching songs
   * runs this way, so each version holds one song's Set and sheet and lands in that song's history.
   */
  afterPending<R>(task: () => Promise<R>): Promise<R> {
    return this.enqueue(task);
  }

  /** How the History list shows a version. */
  listItem(version: Version): VersionListItem {
    return VersionHistory.item(version);
  }

  /** Saves the version; the history compares it with the one before and works out its summary from the changes. */
  private async record(
    snapshot: SetSnapshot,
    author: VersionAuthor,
    summarize: (changes: SetChange[]) => string,
    request?: string,
    recovery?: RecoveryReceipt,
  ): Promise<RecordedVersion> {
    const version = await this.versions.history.record(snapshot, author, summarize, request, recovery);
    if (version) this.emit({ type: "version", version: this.listItem(version) });
    return { snapshot, version, changes: version ? version.changes : [] };
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
