import type { SelectionInfo, TransportState } from "../shared/live-ops";
import type { SetContents, SetSnapshot } from "../shared/set-snapshot";
import type { SongStore } from "../mneme/song-store";
import type { SetReader } from "../tools/define";
import type { LiveConnections, LiveLink } from "../shared/live";

/** The Set couldn't be read in full, so nothing that depends on it (a version, a request) goes ahead. */
export class SetReadError extends Error {}

/**
 * Reads the whole Set as one snapshot: every track, device and clip from the extension, the transport
 * and the selection from the Ode device, and the song's lead sheet. A snapshot is complete or not taken at all.
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

  /** Another Set is open: the last snapshot no longer describes it. */
  forget(): void {
    this.last = null;
  }

  async read(): Promise<SetSnapshot> {
    const { extension, device } = this.live;
    for (const link of [extension, device]) {
      if (!link.connected()) throw SnapshotReader.cannotRead(link.fix);
    }
    try {
      const [contents, transport, selection, sheet] = await Promise.all([
        extension.call<SetContents>("set_snapshot", {}),
        device.call<TransportState>("transport_get", {}),
        device.call<SelectionInfo>("selection_get", {}),
        this.song.read(),
      ]);
      const snapshot: SetSnapshot = { ...contents, takenAt: new Date().toISOString(), transport, selection, sheet };
      this.last = snapshot;
      return snapshot;
    } catch (error) {
      throw SnapshotReader.cannotRead(SnapshotReader.reason(error, [extension, device]));
    }
  }

  private static cannotRead(fix: string): SetReadError {
    return new SetReadError(`Ode can't read the Set: ${fix}`);
  }

  /** A part that dropped while reading gets its fix; any other failure is reported as it is. */
  private static reason(error: unknown, links: LiveLink[]): string {
    const dropped = links.find((link) => !link.connected());
    if (dropped) return dropped.fix;
    return error instanceof Error ? error.message : String(error);
  }
}
