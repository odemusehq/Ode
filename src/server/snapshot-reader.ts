import type { LiveConnections } from "../shared/live";
import type { SetContents, SetSnapshot } from "../shared/set-snapshot";
import type { SongStore } from "../mneme/song-store";
import type { SetReader } from "../tools/define";

/** The Set couldn't be read in full, so whatever depends on it (a version, a request) waits. */
export class SetReadError extends Error {}

/**
 * Reads the whole Set as one snapshot: every track, device and clip through the extension, and the song's lead sheet.
 * A snapshot is taken whole.
 */
export class SnapshotReader implements SetReader {
  private last: SetSnapshot | null = null;

  constructor(
    private readonly live: LiveConnections,
    private readonly song: SongStore,
  ) {}

  /** The most recent snapshot taken, or null before the first one. */
  get latest(): SetSnapshot | null {
    return this.last;
  }

  /** Another song is in use: the last snapshot belongs to the one before. */
  forget(): void {
    this.last = null;
  }

  async read(): Promise<SetSnapshot> {
    try {
      const [contents, sheet] = await Promise.all([this.live.extension.call<SetContents>("set_snapshot", {}), this.song.read()]);
      const snapshot: SetSnapshot = { ...contents, takenAt: new Date().toISOString(), sheet };
      this.last = snapshot;
      return snapshot;
    } catch (error) {
      throw new SetReadError(`Ode can't read the Set: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
