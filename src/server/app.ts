import { join } from "node:path";
import type { OdeConfig } from "../shared/config";
import type { LeadSheet } from "../shared/song";
import type { LiveStatus } from "../shared/live";
import type { MeterReading, SetInfo } from "../shared/live-ops";
import { Mneme } from "../mneme/artist";
import { userPaths, type UserPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SongStore, SongVersions } from "../mneme/song-store";
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
import { Listening } from "./listening";
import { LiveHub } from "./live-hub";
import { PointerState } from "./pointer";
import { Questions } from "./questions";
import { RequestContext } from "./request-context";
import { SelectionState } from "./selection";
import { MelodySettings } from "./melody-settings";
import { SnapshotReader } from "./snapshot-reader";
import { SuggestionFinder } from "./suggestions";
import { VersionActions } from "./version-actions";
import { VersionRecorder } from "./version-recorder";

/** Builds every part of Ode and connects them. */
export class OdeApp {
  readonly bus = new EventBus();
  readonly pointer = new PointerState();
  readonly paths: UserPaths;
  readonly prefs: PreferencesStore;
  readonly mneme: Mneme;
  readonly song: SongStore;
  readonly versions: SongVersions;
  readonly live: LiveHub;
  readonly services: ModelServices;
  readonly approvals: Approvals;
  readonly questions: Questions;
  readonly reader: SnapshotReader;
  readonly recorder: VersionRecorder;
  readonly selection: SelectionState;
  readonly sessions: SessionManager;
  readonly versionActions: VersionActions;
  private readonly server: OdeServer;

  constructor(readonly config: OdeConfig) {
    const emit = this.bus.emit;
    this.paths = userPaths(config.userDir);
    this.prefs = new PreferencesStore(join(this.paths.preferences, "preferences.json"));
    this.mneme = new Mneme(this.paths, config.memory.halfLifeDays);
    this.song = new SongStore(this.paths, (sheet) => this.onSongChanged(sheet));
    this.versions = new SongVersions(this.song, config.versions.snapshotEvery);
    this.live = new LiveHub(config.host, config.bridgePort, config.liveTimeouts, {
      onSetInfo: (info) => void this.onSetOpened(info),
      onMeters: (reading) => this.onMeters(reading),
      onStatus: (status) => this.onStatus(status),
      onSelection: (selection) => void this.selection.select(selection).catch(() => undefined),
      onCommand: (command) => void this.versionActions.command(command),
    });
    this.services = new ModelServices(config);
    this.approvals = new Approvals(emit);
    this.questions = new Questions(emit);
    this.reader = new SnapshotReader(this.live, this.song);
    this.recorder = new VersionRecorder(this.reader, this.versions, emit);
    this.selection = new SelectionState({
      live: this.live,
      reader: this.reader,
      versions: this.versions,
      finder: new SuggestionFinder(this.live, this.song, this.prefs),
      busy: () => this.sessions.current.isBusy,
      emit,
    });

    const context: ToolContext = {
      config,
      live: this.live,
      song: this.song,
      versions: this.versions,
      snapshots: this.reader,
      questions: this.questions,
      mneme: this.mneme,
      prefs: this.prefs,
      services: this.services,
      emit,
    };
    const registry = new ToolRegistry(context);
    const requests = new RequestContext({
      config,
      live: this.live,
      reader: this.reader,
      recorder: this.recorder,
      versions: this.versions,
      summary: new ContextSummary(this.mneme, this.song, this.prefs, config.memory.summaryMaxChars),
      prefs: this.prefs,
      selection: this.selection,
      listening: new Listening(this.live, this.reader),
      emit,
    });
    this.sessions = new SessionManager(
      {
        config,
        workspace: new Workspace(this.paths.workspace, join(config.repoDir, "skills")),
        registry,
        agents: new OdeAgents(config, registry),
        approvals: this.approvals,
        questions: this.questions,
        prefs: this.prefs,
        requests,
        emit,
      },
      join(this.paths.workspace, "sessions.json"),
    );
    this.versionActions = new VersionActions({
      live: this.live,
      song: this.song,
      versions: this.versions,
      recorder: this.recorder,
      sessions: this.sessions,
      emit,
    });
    this.server = new OdeServer({
      config,
      bus: this.bus,
      live: this.live,
      song: this.song,
      mneme: this.mneme,
      prefs: this.prefs,
      services: this.services,
      approvals: this.approvals,
      questions: this.questions,
      sessions: this.sessions,
      versions: this.versionActions,
      selection: this.selection,
      melody: new MelodySettings(this.reader, this.prefs),
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
    if (info.setId !== this.song.setId) this.reader.forget();
    await this.song.open(location);
    await this.sessions.switchTo(info.setId, firstSave);
    await this.versionActions.restoreOnOpen();
  }

  /** A copy made from History waits for the extension and the Ode device before it goes back to its version. */
  private onStatus(status: LiveStatus): void {
    this.bus.emit({ type: "live-status", status });
    if (status.extension && status.device) void this.versionActions.restoreOnOpen();
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
