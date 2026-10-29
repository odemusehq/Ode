import { join } from "node:path";
import type { OdeConfig } from "../shared/config";
import type { LeadSheet } from "../shared/song";
import type { LiveStatus } from "../shared/live";
import type { SetInfo } from "../shared/live-ops";
import { Mneme } from "../mneme/artist";
import { LyricsStore } from "../mneme/lyrics-store";
import { userPaths, type UserPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore, SongVersions } from "../mneme/song-store";
import { ContextSummary } from "../mneme/summary";
import { ModelServices } from "../services";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import { OdeAgents } from "../agents/agents";
import { Approvals } from "../harness/approvals";
import { SessionManager } from "../harness/session-manager";
import { Workspace } from "../harness/workspace";
import { DeletionChecker } from "./deletion-checker";
import { EventBus } from "./event-bus";
import { OdeServer } from "./http";
import { Listening } from "./listening";
import { LiveHub } from "./live-hub";
import { Questions } from "./questions";
import { RequestContext } from "./request-context";
import { SelectionState } from "./selection";
import { SnapshotReader } from "./snapshot-reader";
import { SongTitle } from "./song-title";
import { SuggestionFinder } from "./suggestions";
import { VersionActions } from "./version-actions";
import { VersionRecorder } from "./version-recorder";

/** Builds every part of Ode and connects them. */
export class OdeApp {
  readonly bus = new EventBus();
  readonly paths: UserPaths;
  readonly prefs: PreferencesStore;
  readonly mneme: Mneme;
  readonly song: SongStore;
  readonly lyrics: LyricsStore;
  readonly versions: SongVersions;
  readonly live: LiveHub;
  readonly settings: SettingsStore;
  readonly models: ModelRoles;
  readonly services: ModelServices;
  readonly approvals: Approvals;
  readonly questions: Questions;
  readonly reader: SnapshotReader;
  readonly recorder: VersionRecorder;
  readonly selection: SelectionState;
  readonly sessions: SessionManager;
  readonly versionActions: VersionActions;
  private readonly server: OdeServer;
  /** The song title the windows were last sent. */
  private title = "";

  constructor(readonly config: OdeConfig) {
    const emit = this.bus.emit;
    this.paths = userPaths(config.userDir);
    this.prefs = new PreferencesStore(join(this.paths.preferences, "preferences.json"));
    this.mneme = new Mneme(this.paths, config.memory.halfLifeDays);
    this.song = new SongStore(this.paths, (sheet) => this.onSongChanged(sheet));
    this.lyrics = new LyricsStore(this.song, this.prefs, (lyrics) => emit({ type: "lyrics", lyrics }));
    this.versions = new SongVersions(this.song, config.versions.snapshotEvery);
    this.live = new LiveHub(config.host, config.bridgePort, config.liveTimeouts, {
      onSetInfo: (info) => void this.onSetOpened(info).catch((error: unknown) => this.showError(error)),
      onStatus: (status) => this.onStatus(status),
      onSelection: (selection) => void this.selection.select(selection).catch(() => undefined),
      onCommand: (command) => void this.versionActions.command(command),
    });
    this.settings = new SettingsStore(this.paths.root, ProviderCatalog.bundled);
    this.models = new ModelRoles(this.settings, ProviderCatalog.bundled);
    this.services = new ModelServices(this.models);
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
      lyrics: this.lyrics,
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
        deletions: new DeletionChecker(this.reader),
        emit,
      },
      join(this.paths.workspace, "sessions.json"),
    );
    this.versionActions = new VersionActions({
      live: this.live,
      song: this.song,
      lyrics: this.lyrics,
      versions: this.versions,
      recorder: this.recorder,
      sessions: this.sessions,
      selection: this.selection,
      emit,
    });
    this.server = new OdeServer({
      config,
      bus: this.bus,
      live: this.live,
      song: this.song,
      lyrics: this.lyrics,
      prefs: this.prefs,
      services: this.services,
      settings: this.settings,
      models: this.models,
      approvals: this.approvals,
      questions: this.questions,
      sessions: this.sessions,
      versions: this.versionActions,
      selection: this.selection,
    });
  }

  start(): void {
    this.live.start();
    this.server.start();
  }

  /**
   * The Ode device reported the Set open in Live. The same Set saved for the first time or under a new name carries
   * on its conversation; another Set gets its own, and the last snapshot is forgotten.
   */
  private async onSetOpened(info: SetInfo): Promise<void> {
    const location = { setId: info.setId, filePath: info.filePath, instance: info.instance };
    const continues = this.song.continues(location);
    if (!continues) this.reader.forget();
    await this.song.open(location);
    await this.sessions.switchTo(info.setId, continues);
    this.showTitle((await this.song.read()).title);
    await this.versionActions.restoreOnOpen();
  }

  /** A copy made from History waits for the extension and the Ode device before it goes back to its version. */
  private onStatus(status: LiveStatus): void {
    this.bus.emit({ type: "live-status", status });
    if (status.extension && status.device) void this.versionActions.restoreOnOpen();
  }

  /** Keeps the windows' song title and Mneme's index of the artist's songs up to date. */
  private onSongChanged(sheet: LeadSheet): void {
    this.showTitle(sheet.title);
    const setId = this.song.setId;
    if (!setId) return;
    const dataDir = this.song.dataDir;
    void this.song
      .lyrics()
      .then((lyrics) => this.mneme.rememberSong({ setId, title: sheet.title, dataDir, lyrics }))
      .catch(() => undefined);
  }

  /** Sends the song's title to the windows when it is not the one they show. */
  private showTitle(sheetTitle: string): void {
    const title = SongTitle.of(sheetTitle, this.song.setFilePath);
    if (title === this.title) return;
    this.title = title;
    this.bus.emit({ type: "title", title });
  }

  private showError(error: unknown): void {
    this.bus.emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}
