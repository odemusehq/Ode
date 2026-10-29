import { SessionBusyError } from "../harness/session";
import type { SessionManager } from "../harness/session-manager";
import type { SongEntry, SongStore } from "../mneme/song-store";
import type { SnapshotReader } from "./snapshot-reader";

export interface SongSwitcherDeps {
  song: SongStore;
  sessions: SessionManager;
  reader: SnapshotReader;
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

  async open(id: string): Promise<SongEntry> {
    this.assertIdle();
    return this.switched(await this.deps.song.open(id));
  }

  async create(title: string): Promise<SongEntry> {
    this.assertIdle();
    return this.switched(await this.deps.song.create(title));
  }

  private switched(entry: SongEntry): SongEntry {
    this.deps.reader.forget();
    this.deps.sessions.switchTo(entry.id);
    return entry;
  }

  private assertIdle(): void {
    if (this.deps.sessions.current.isBusy) throw new SessionBusyError("Ode is still working on this song. Wait for it to finish, or press Stop.");
  }
}
