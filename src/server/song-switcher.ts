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
  constructor(private readonly deps: SongSwitcherDeps) {}

  /** Every song, and the one in use now. */
  async list(): Promise<{ current: string; songs: SongEntry[] }> {
    return { current: this.deps.song.songId, songs: await this.deps.song.list() };
  }

  async openLast(): Promise<SongEntry> {
    return this.switched(await this.deps.song.openLast());
  }

  open(id: string): Promise<SongEntry> {
    return this.deps.recorder.afterPending(async () => {
      return this.deps.sessions.current.exclusive(async () => this.switched(await this.deps.song.open(id)));
    });
  }

  create(title: string): Promise<SongEntry> {
    return this.deps.recorder.afterPending(async () => {
      return this.deps.sessions.current.exclusive(async () => this.switched(await this.deps.song.create(title)));
    });
  }

  private async switched(entry: SongEntry): Promise<SongEntry> {
    this.deps.reader.forget();
    this.deps.sessions.switchTo(entry.id);
    await this.deps.sessions.current.recover();
    return entry;
  }

}
