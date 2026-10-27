import { join } from "node:path";
import type { OdeConfig } from "../shared/config";
import type { LeadSheet } from "../shared/song";
import type { MeterReading, SetInfo } from "../shared/live-ops";
import { Mneme } from "../mneme/artist";
import { userPaths, type UserPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore } from "../mneme/song-store";
import { ContextSummary } from "../mneme/summary";
import { ModelServices } from "../services";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import { OdeAgents } from "../agents/agents";
import { Approvals } from "../harness/approvals";
import { SessionManager } from "../harness/session-manager";
import { Workspace } from "../harness/workspace";
import { analyzeLyrics } from "../music";
import { EventBus } from "./event-bus";
import { OdeServer } from "./http";
import { LiveHub } from "./live-hub";
import { PointerState } from "./pointer";

/** Builds every part of Ode and connects them. */
export class OdeApp {
  readonly bus = new EventBus();
  readonly pointer = new PointerState();
  readonly paths: UserPaths;
  readonly prefs: PreferencesStore;
  readonly mneme: Mneme;
  readonly song: SongStore;
  readonly live: LiveHub;
  readonly services: ModelServices;
  readonly approvals: Approvals;
  readonly sessions: SessionManager;
  private readonly server: OdeServer;

  constructor(readonly config: OdeConfig) {
    this.paths = userPaths(config.userDir);
    this.prefs = new PreferencesStore(join(this.paths.preferences, "preferences.json"));
    this.mneme = new Mneme(this.paths, config.memory.halfLifeDays);
    this.song = new SongStore(this.paths, (sheet) => this.onSongChanged(sheet));
    this.live = new LiveHub(config.host, config.bridgePort, config.liveTimeouts, {
      onSetInfo: (info) => void this.onSetOpened(info),
      onMeters: (reading) => this.onMeters(reading),
      onStatus: (status) => this.bus.emit({ type: "live-status", status }),
    });
    this.services = new ModelServices(config);
    this.approvals = new Approvals(this.bus.emit, this.prefs, this.song);

    const context: ToolContext = {
      config,
      live: this.live,
      song: this.song,
      mneme: this.mneme,
      prefs: this.prefs,
      services: this.services,
      emit: this.bus.emit,
    };
    const registry = new ToolRegistry(context);
    this.sessions = new SessionManager(
      {
        config,
        workspace: new Workspace(this.paths.workspace, join(config.repoDir, "skills")),
        registry,
        agents: new OdeAgents(config, registry),
        approvals: this.approvals,
        summary: new ContextSummary(this.mneme, this.song, this.prefs, config.memory.summaryMaxChars),
        live: this.live,
        emit: this.bus.emit,
        pointer: () => this.pointer.current,
      },
      join(this.paths.workspace, "sessions.json"),
    );
    this.server = new OdeServer({
      config,
      bus: this.bus,
      live: this.live,
      song: this.song,
      mneme: this.mneme,
      prefs: this.prefs,
      services: this.services,
      approvals: this.approvals,
      sessions: this.sessions,
      pointer: this.pointer,
      analyzeLyrics,
    });
  }

  start(): void {
    this.live.start();
    this.server.start();
  }

  private async onSetOpened(info: SetInfo): Promise<void> {
    const location = { setId: info.setId, filePath: info.filePath };
    const firstSave = this.song.isFirstSave(location);
    await this.song.open(location);
    await this.sessions.switchTo(info.setId, firstSave);
  }

  private onSongChanged(sheet: LeadSheet): void {
    this.bus.emit({ type: "song", leadSheet: sheet });
    const setId = this.song.setId;
    if (!setId) return;
    const lyrics = sheet.sections.flatMap((section) => section.lines.map((line) => line.text));
    void this.mneme.rememberSong({ setId, title: sheet.title, dataDir: this.song.dataDir, lyrics });
  }

  private onMeters(reading: MeterReading): void {
    this.bus.emit({
      type: "meters",
      tracks: reading.tracks.map((track) => ({ name: track.name, level: Math.max(track.left, track.right) })),
      master: { level: Math.max(reading.master.left, reading.master.right) },
    });
  }
}
