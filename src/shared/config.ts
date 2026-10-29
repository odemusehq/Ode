import defaults from "./defaults.json";

export const ROLES = [
  "main",
  "subagent",
  "audio_understanding",
  "transcription",
  "image_generation",
  "stem_separation",
  "singing_voice",
  "sound_generation",
] as const;
export type Role = (typeof ROLES)[number];

export interface RoleConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** A header that keeps one conversation's requests on the same server, where the provider asks for it. */
  conversationHeader?: string;
}

export interface AgentLimits {
  /** How deep subagents can start their own subagents. */
  subagentDepth: number;
  subagentsAtOnce: number;
  /** Subagents one request may start in all, at every depth. */
  subagentsPerRequest: number;
  /** Model calls one request may make before Ode stops it, subagents' calls included. */
  turnsPerRequest: number;
  /** Tokens, sent and received, one request may use before Ode stops it, subagents' tokens included. */
  tokensPerRequest: number;
  /** The longest answer a single model call may give, in tokens. */
  tokensPerTurn: number;
  /** Earlier requests and Ode's replies carried into each new request of the same song. */
  historyExchanges: number;
  /** How many tools one tool search offers. */
  toolSearchResults: number;
  /** The longest tool result the model reads, in characters; a longer one is cut with a note to ask for less. */
  toolResultMaxChars: number;
}

export interface MemorySettings {
  /** Things Ode noticed fade by half over this many days, so recent habits outweigh old ones. */
  halfLifeDays: number;
  /** Size limit of the summary of the artist and the song given to the model before each request. */
  summaryMaxChars: number;
  /** Size limit of the compact project map sent with every request. */
  mapMaxChars: number;
}

export interface VersionSettings {
  /** A full snapshot is stored every this many versions, so restoring stays fast. */
  snapshotEvery: number;
  /** History groups consecutive versions by the same author made within this many minutes. */
  groupMinutes: number;
  /** How many versions version_list gives when the agent asks for no particular number, newest first. */
  listLimit: number;
}

export interface ReleaseSettings {
  /** How many cover art images Ode makes for the musician to pick from. */
  coverChoices: number;
}

export interface ServiceSettings {
  /** The sample rate speech models expect, in Hz (16 or 24 kHz). */
  speechSampleRate: number;
  /** The longest answer to a one-off text request, in tokens. */
  textMaxTokens: number;
  /** The longest answer about a recording, in tokens; reasoning shares it, so a low limit gives an empty answer. */
  audioMaxTokens: number;
  /** The size asked of the image model, before the image is scaled to the cover size. */
  imageRequestSize: string;
  /** The cover's side in pixels: release platforms ask for square artwork of at least 3000 × 3000. */
  coverSize: number;
}

export interface ServerSettings {
  /** How often the event stream to an open dialog sends a keepalive, in milliseconds. */
  keepaliveMs: number;
}

export interface SuggestionSettings {
  /** How many one-tap suggestions Ask Ode offers for what the musician pointed at. */
  perSelection: number;
}

/** The dialogs Ode opens from Live's right-click menu, each a view of Ode's page. */
export enum DialogView {
  Ask = "ask",
  Lyrics = "lyrics",
  History = "history",
  Settings = "settings",
}

/** A dialog's size in Live, in pixels. */
export interface DialogSize {
  width: number;
  height: number;
}

/**
 * Ode's configuration: the two folders Live gives the extension, and the tunable values every copy of Ode shares,
 * bundled as defaults.json. Models and keys are the musician's own, chosen in Settings.
 */
export class OdeConfig {
  /** The size of the small notice Ode shows when it has something to tell the musician, ready before the folders are known. */
  static readonly notice: DialogSize = { ...defaults.notice };
  /** What the model services ask of each provider, the same for every copy of Ode. */
  static readonly services: ServiceSettings = { ...defaults.services };

  readonly limits: AgentLimits = { ...defaults.agent };
  readonly memory: MemorySettings = { ...defaults.memory };
  readonly versions: VersionSettings = { ...defaults.versions };
  readonly release: ReleaseSettings = { ...defaults.release };
  readonly server: ServerSettings = { ...defaults.server };
  readonly suggestions: SuggestionSettings = { ...defaults.suggestions };
  readonly dialogs: Record<DialogView, DialogSize> = { ...defaults.dialogs };

  constructor(
    /** The extension's storage folder, kept across Live sessions: Settings, the artist, the songs. */
    readonly userDir: string,
    /** The extension's temp folder, which Live may clear between sessions: renders and generated files. */
    readonly tempDir: string,
  ) {}
}
