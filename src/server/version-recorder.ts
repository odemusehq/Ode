import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor, type SetChange, type Version, type VersionListItem } from "../shared/versions";
import { SetDiff } from "../mneme/set-diff";
import type { SongVersions } from "../mneme/song-store";
import { VersionHistory } from "../mneme/version-history";
import type { SnapshotReader } from "./snapshot-reader";

export interface RecordedVersion {
  /** The Set as it was read for this version. */
  snapshot: SetSnapshot;
  /** The saved version, or null when nothing changed. */
  version: Version | null;
  /** What changed since the previous version (none for the first version). */
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
  odeChange(resultLine: string, request: string): Promise<RecordedVersion> {
    return this.enqueue(async () => {
      const snapshot = await this.reader.read();
      return this.record(snapshot, VersionAuthor.Ode, (changes) => resultLine || SetDiff.summary(changes), request);
    });
  }

  /**
   * Reads the Set and saves what Ode changed before it was cut short, as "<what>: 3 edits on Bass" (for example
   * "Stopped" or "Restore stopped part-way"), so Undo can go back to before it.
   */
  odeCutShort(what: string, request?: string): Promise<RecordedVersion> {
    return this.enqueue(async () => {
      const snapshot = await this.reader.read();
      return this.record(snapshot, VersionAuthor.Ode, (changes) => `${what}: ${SetDiff.summary(changes)}`, request);
    });
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
  ): Promise<RecordedVersion> {
    const version = await this.versions.history.record(snapshot, author, summarize, request);
    if (version) this.emit({ type: "version", version: this.listItem(version) });
    return { snapshot, version, changes: version ? version.changes : [] };
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
