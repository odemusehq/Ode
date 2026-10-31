import defaults from "./defaults.json";

export const ROLES = [
  "main",
  "subagent",
  "audio_understanding",
  "transcription",
  "lyrics_check",
] as const;
export type Role = (typeof ROLES)[number];

export interface RoleConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** A header that keeps one conversation's requests on the same server, where the provider asks for it. */
  conversationHeader?: string;
  /** The reasoning effort to ask for, where the role sets one: Lyrics support asks for the model's lowest. */
  effort?: string;
}

export interface AgentLimits {
  /** How deep subagents can start their own subagents. */
  subagentDepth: number;
  subagentsAtOnce: number;
  /** Subagents one request may start in all, at every depth. */
  subagentsPerRequest: number;
  /** Emergency backstop for a production request, including compaction and subagents. */
  turnsPerRequest: number;
  /** Tokens, sent and received, one request may use before Ode stops it, subagents' tokens included. */
  tokensPerRequest: number;
  /** The longest answer a single model call may give, in tokens. */
  tokensPerTurn: number;
  /** Estimated active context size that triggers a summary before the next model call. Includes tool definitions. */
  compactAtTokens: number;
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
  /** How many facts about the artist the summary names, strongest first. */
  summaryFacts: number;
  /** How many of the artist's habits the summary names, the strongest first. */
  summaryHabits: number;
  /** A habit enters the summary once the musician kept or rejected it at least this many times. */
  habitMinOutcomes: number;
  /** The confidence (0–1) of a fact Ode noticed when the agent leaves it out. */
  unratedConfidence: number;
}

export interface VersionSettings {
  /** A full snapshot is stored every this many versions, so restoring stays fast. */
  snapshotEvery: number;
  /** History groups consecutive versions by the same author made within this many minutes. */
  groupMinutes: number;
  /** How many versions version_list gives when the agent leaves the number open, newest first. */
  listLimit: number;
}

export interface ServiceSettings {
  /** The longest answer to a one-off text request, in tokens. */
  textMaxTokens: number;
  /** The longest answer about a recording, in tokens; reasoning shares it, so a low limit gives an empty answer. */
  audioMaxTokens: number;
}

export interface ServerSettings {
  /** How often the event stream to an open dialog sends a keepalive, in milliseconds. */
  keepaliveMs: number;
}

export interface LyricsSupportSettings {
  /** The longest answer Lyrics support may give for one section, reasoning included. */
  maxTokens: number;
  /** How many checked sections Ode keeps, so a section seen before is marked at once. */
  cacheSize: number;
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
  readonly server: ServerSettings = { ...defaults.server };
  readonly lyricsSupport: LyricsSupportSettings = { ...defaults.lyricsSupport };
  readonly dialogs: Record<DialogView, DialogSize> = { ...defaults.dialogs };

  constructor(
    /** The extension's storage folder, kept across Live sessions: Settings, the artist, the songs. */
    readonly userDir: string,
    /** The extension's temp folder, which Live may clear between sessions: renders and listening files. */
    readonly tempDir: string,
  ) {}
}
