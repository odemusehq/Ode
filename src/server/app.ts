import { join } from "node:path";
import { DialogView, type OdeConfig } from "../shared/config";
import type { LiveConnections } from "../shared/live";
import type { LeadSheet } from "../shared/song";
import { OdeAgents } from "../agents/agents";
import { Approvals } from "../harness/approvals";
import { AgentLoop } from "../harness/loop";
import { SessionManager } from "../harness/session-manager";
import { SkillLibrary } from "../harness/skills";
import type { TextLibrary } from "../harness/texts";
import { ToolLabels } from "../harness/tool-labels";
import { Mneme } from "../mneme/artist";
import { ConversationStore } from "../mneme/conversations";
import { ProductionTaskStore } from "../mneme/production-task";
import { ProductionEvidence } from "../mneme/production-evidence";
import { ToolObservations } from "../mneme/tool-observations";
import { LyricsStore } from "../mneme/lyrics-store";
import { TempFolder, userPaths, type UserPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore, SongVersions } from "../mneme/song-store";
import { ContextSummary } from "../mneme/summary";
import { ModelServices } from "../services";
import { LyricsChecker } from "../services/lyrics-checker";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/define";
import { DeletionChecker } from "./deletion-checker";
import { EventBus } from "./event-bus";
import { OdeServer, type UiFiles } from "./http";
import { Questions } from "./questions";
import { RequestContext } from "./request-context";
import { SelectionState } from "./selection";
import { SnapshotReader } from "./snapshot-reader";
import { SongSwitcher } from "./song-switcher";
import { SongTitle } from "./song-title";
import { SuggestionFinder } from "./suggestions";
import { VersionActions } from "./version-actions";
import { VersionRecorder } from "./version-recorder";

/** Builds every part of Ode inside the extension and connects them. */
export class OdeApp {
  readonly bus = new EventBus();
  readonly paths: UserPaths;
  readonly temp: TempFolder;
  readonly prefs: PreferencesStore;
  readonly mneme: Mneme;
  readonly song: SongStore;
  readonly lyrics: LyricsStore;
  readonly conversations: ConversationStore;
  readonly observations: ToolObservations;
  readonly production: ProductionTaskStore;
  readonly versions: SongVersions;
  readonly settings: SettingsStore;
  readonly models: ModelRoles;
  readonly services: ModelServices;
  readonly approvals: Approvals;
  readonly questions: Questions;
  readonly reader: SnapshotReader;
  readonly recorder: VersionRecorder;
  readonly selection: SelectionState;
  readonly sessions: SessionManager;
  readonly songs: SongSwitcher;
  readonly versionActions: VersionActions;
  private readonly server: OdeServer;
  /** The song title the dialogs were last sent. */
  private title = "";

  constructor(
    readonly config: OdeConfig,
    readonly live: LiveConnections,
    texts: TextLibrary,
    ui: UiFiles,
  ) {
    const emit = this.bus.emit;
    this.paths = userPaths(config.userDir);
    this.temp = new TempFolder(config.tempDir);
    this.prefs = new PreferencesStore(join(this.paths.preferences, "preferences.json"));
    this.mneme = new Mneme(this.paths, config.memory);
    this.song = new SongStore(this.paths, (sheet) => this.onSongChanged(sheet));
    this.lyrics = new LyricsStore(this.song, this.prefs, (lyrics) => emit({ type: "lyrics", lyrics }));
    this.versions = new SongVersions(this.song, config.versions.snapshotEvery);
    this.conversations = new ConversationStore(join(this.paths.workspace, "conversations"), config.limits.historyExchanges);
    this.observations = new ToolObservations(this.song);
    this.production = new ProductionTaskStore(this.song, new ProductionEvidence({ song: this.song, observations: this.observations, versions: this.versions, conversations: this.conversations, isRelevantTool: (name) => registry.find(name) !== undefined }).verify);
    this.settings = new SettingsStore(this.paths.root, ProviderCatalog.bundled);
    this.models = new ModelRoles(this.settings, ProviderCatalog.bundled);
    this.services = new ModelServices(this.models);
    this.approvals = new Approvals(emit);
    this.questions = new Questions(emit);
    this.reader = new SnapshotReader(live, this.song);
    this.recorder = new VersionRecorder(this.reader, this.versions, emit);
    this.selection = new SelectionState({
      reader: this.reader,
      versions: this.versions,
      finder: new SuggestionFinder(live, this.song, this.prefs, config.suggestions.perSelection),
      busy: () => this.sessions.current.isBusy,
      emit,
    });

    const context: ToolContext = {
      config,
      live,
      song: this.song,
      lyrics: this.lyrics,
      production: this.production,
      versions: this.versions,
      snapshots: this.reader,
      questions: this.questions,
      mneme: this.mneme,
      prefs: this.prefs,
      services: this.services,
      temp: this.temp,
      emit,
    };
    const registry = new ToolRegistry(context);
    const requests = new RequestContext({
      config,
      live,
      song: this.song,
      reader: this.reader,
      recorder: this.recorder,
      versions: this.versions,
      production: this.production,
      summary: new ContextSummary(this.mneme, this.song, this.prefs, config.memory),
      prefs: this.prefs,
      selection: this.selection,
      emit,
    });
    const skills = new SkillLibrary(texts);
    const agents = new OdeAgents(texts, skills);
    const labels = new ToolLabels(registry);
    const loop = new AgentLoop({
      services: this.services,
      observations: this.observations,
      registry,
      skills,
      labels,
      limits: config.limits,
      subagentPrompt: () => agents.subagentPrompt(),
    });
    this.sessions = new SessionManager(
      {
        loop,
        agents,
        labels,
        approvals: this.approvals,
        questions: this.questions,
        prefs: this.prefs,
        requests,
        production: this.production,
        deletions: new DeletionChecker(this.reader),
        snapshots: this.reader,
        emit,
      },
      this.conversations,
    );
    this.songs = new SongSwitcher({ song: this.song, sessions: this.sessions, reader: this.reader, recorder: this.recorder });
    this.versionActions = new VersionActions({
      live,
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
      song: this.song,
      songs: this.songs,
      lyrics: this.lyrics,
      services: this.services,
      lyricsChecker: new LyricsChecker(this.services, texts, config.lyricsSupport),
      prefs: this.prefs,
      settings: this.settings,
      models: this.models,
      approvals: this.approvals,
      questions: this.questions,
      sessions: this.sessions,
      versions: this.versionActions,
      selection: this.selection,
      ui,
    });
  }

  /** Opens the song used last and starts the local server the dialogs load from. */
  async start(): Promise<void> {
    await this.songs.openLast();
    await this.server.start();
    // The address carries this session's token for the development tools (ODE_DEV_SERVER); the server's Host and
    // Origin checks keep every other page out.
    console.log(`Ode is ready at ${this.server.url(DialogView.Ask)}`);
  }

  /** The address a dialog opens: one of Ode's views on the local server, with this session's token. */
  dialogUrl(view: DialogView): string {
    return this.server.url(view);
  }

  /** Keeps the dialogs' song title and Mneme's index of the artist's songs up to date. */
  private onSongChanged(sheet: LeadSheet): void {
    this.showTitle(sheet.title);
    const songId = this.song.songId;
    if (!songId) return;
    void this.song
      .lyrics()
      .then((lyrics) => this.mneme.rememberSong({ songId, title: sheet.title, lyrics }))
      .catch(() => undefined);
  }

  /** Sends the song's title to the dialogs when it changes. */
  private showTitle(sheetTitle: string): void {
    const title = SongTitle.of(sheetTitle);
    this.title = title;
    this.bus.emit({ type: "title", title, songId: this.song.songId });
  }
}
