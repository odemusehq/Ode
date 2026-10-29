import { config as loadDotenv, parse } from "dotenv";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  /** Model calls one request may make before Ode stops it. */
  turnsPerRequest: number;
  /** Tokens, sent and received, one request may use before Ode stops it. */
  tokensPerRequest: number;
  /** The longest answer a single model call may give, in tokens. */
  tokensPerTurn: number;
  /** Earlier requests and Ode's replies carried into each new request of the same song. */
  historyExchanges: number;
  /** How many tools one tool search offers. */
  toolSearchResults: number;
}

export interface LiveTimeouts {
  /** Milliseconds. */
  normal: number;
  /** Milliseconds, for rendering audio and measuring the Master. */
  long: number;
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
}

export interface ReleaseSettings {
  /** How many cover art images Ode makes for the musician to pick from. */
  coverChoices: number;
}

export class ConfigError extends Error {}

/** Reads the settings of the machine Ode runs on from the environment, loaded from the repo's .env (see .env.example). */
class EnvReader {
  private readonly missing: string[] = [];

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  required(key: string): string {
    const value = this.env[key]?.trim() ?? "";
    if (!value) this.missing.push(key);
    return value;
  }

  number(key: string): number {
    const raw = this.required(key);
    const value = Number(raw);
    if (raw && !Number.isFinite(value)) this.missing.push(`${key} (must be a number)`);
    return value;
  }

  path(key: string): string {
    const value = this.required(key);
    return /^~[\\/]/.test(value) ? join(homedir(), value.slice(2)) : value;
  }

  assertComplete(): void {
    if (this.missing.length > 0) {
      throw new ConfigError(`Missing settings in .env (see .env.example): ${this.missing.join(", ")}`);
    }
  }
}

/**
 * Ode's configuration: where it runs, from .env, and the tunable values every copy of Ode shares, from the bundled
 * defaults.json. Models and keys are the musician's own, chosen in Settings.
 */
export class OdeConfig {
  static readonly repoDir = fileURLToPath(new URL("../..", import.meta.url));

  readonly limits: AgentLimits = { ...defaults.agent };
  readonly liveTimeouts: LiveTimeouts = {
    normal: defaults.liveTimeouts.normalSeconds * 1000,
    long: defaults.liveTimeouts.longSeconds * 1000,
  };
  readonly memory: MemorySettings = { ...defaults.memory };
  readonly versions: VersionSettings = { ...defaults.versions };
  readonly release: ReleaseSettings = { ...defaults.release };

  private constructor(
    readonly host: string,
    readonly port: number,
    readonly bridgePort: number,
    readonly liveApp: string,
    readonly abletonUserLibrary: string,
    readonly userDir: string,
  ) {}

  get repoDir(): string {
    return OdeConfig.repoDir;
  }

  get serverUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  static load(env: NodeJS.ProcessEnv = process.env): OdeConfig {
    loadDotenv({ path: join(OdeConfig.repoDir, ".env"), quiet: true, processEnv: env });
    const reader = new EnvReader(env);
    // Live's default User Library folder depends on the system, so .env holds one for each.
    const userLibrary = process.platform === "win32" ? "ODE_ABLETON_USER_LIBRARY_WINDOWS" : "ODE_ABLETON_USER_LIBRARY_MACOS";
    const config = new OdeConfig(
      reader.required("ODE_HOST"),
      reader.number("ODE_PORT"),
      reader.number("ODE_BRIDGE_PORT"),
      reader.required("ODE_LIVE_APP"),
      reader.path(userLibrary),
      reader.path("ODE_USER_DIR"),
    );
    reader.assertComplete();
    return config;
  }

  /** The settings in .env.example, whatever the local .env says: what releases of Ode are built with. */
  static defaults(): OdeConfig {
    return OdeConfig.load(parse(readFileSync(join(OdeConfig.repoDir, ".env.example"), "utf8")));
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OdeConfig {
  return OdeConfig.load(env);
}
