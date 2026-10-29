import { SessionBusyError } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import type { SongEntry, SongStore } from "../mneme/song-store";
import type { SnapshotReader } from "./snapshot-reader";
import type { VersionRecorder } from "./version-recorder";

export interface SongSwitcherDeps {
  song: SongStore;
  sessions: SessionManager;
  reader: SnapshotReader;
  recorder: VersionRecorder;
}

/** The songs the musician works on with Ode, and moving between them: the lead sheet, history and conversation go together. */
export class SongSwitcher {
  private switching = false;

  constructor(private readonly deps: SongSwitcherDeps) {}

  get isSwitching(): boolean {
    return this.switching;
  }

  /** Every song, and the one in use now. */
  async list(): Promise<{ current: string; songs: SongEntry[] }> {
    return { current: this.deps.song.songId, songs: await this.deps.song.list() };
  }

  async openLast(): Promise<SongEntry> {
    return this.changeSong(() => this.deps.song.openLast());
  }

  open(id: string): Promise<SongEntry> {
    return this.changeSong(() => this.deps.song.open(id));
  }

  create(title: string): Promise<SongEntry> {
    return this.changeSong(() => this.deps.song.create(title));
  }

  private async changeSong(open: () => Promise<SongEntry>): Promise<SongEntry> {
    if (this.switching) throw new SessionBusyError("Ode is switching songs. Wait for the song to open, then try again.");
    this.switching = true;
    try {
      // Finalise the old session's busy event before publishing the new session.
      const entry = await this.deps.recorder.afterPending(() => this.deps.sessions.current.exclusive(open));
      return await this.switched(entry);
    } finally {
      this.switching = false;
    }
  }

  private async switched(entry: SongEntry): Promise<SongEntry> {
    this.deps.reader.forget();
    this.deps.sessions.switchTo(entry.id);
    await this.deps.sessions.current.recover();
    return entry;
  }
}
