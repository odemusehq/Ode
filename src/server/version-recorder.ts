import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import { VersionAuthor, type SetChange, type Version, type VersionListItem } from "../shared/versions";
import { SetDiff } from "../mneme/set-diff";
import type { SongVersions } from "../mneme/song-store";
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

  /** How the History list shows a version. */
  async listItem(version: Version): Promise<VersionListItem> {
    const items = await this.versions.history.items();
    return items.find((item) => item.id === version.id) ?? VersionRecorder.fallbackItem(version);
  }

  /** The first version of a song is where its history starts: the Set as Ode first found it, saved as the musician's. */
  private async record(
    snapshot: SetSnapshot,
    author: VersionAuthor,
    summarize: (changes: SetChange[]) => string,
    request?: string,
  ): Promise<RecordedVersion> {
    const history = this.versions.history;
    const previous = await history.latest();
    const changes = previous ? SetDiff.between(previous, snapshot) : [];
    const version = previous
      ? await history.record(snapshot, author, summarize(changes), request)
      : await history.record(snapshot, VersionAuthor.Musician, summarize(changes));
    if (version) this.emit({ type: "version", version: await this.listItem(version) });
    return { snapshot, version, changes: version ? changes : [] };
  }

  private static fallbackItem({ changes, ...version }: Version): VersionListItem {
    const tracks = [...new Set(changes.flatMap((change) => ("track" in change.target ? [change.target.track.name] : [])))];
    return { ...version, tracks, changeCount: changes.length };
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
