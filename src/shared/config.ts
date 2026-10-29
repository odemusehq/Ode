import { config as loadDotenv, parse } from "dotenv";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
  subagentDepth: number;
  subagentsAtOnce: number;
  budgetUsdPerRequest: number;
}

export interface LiveTimeouts {
  /** Milliseconds. */
  normal: number;
  /** Milliseconds, for rendering audio and measuring the Master. */
  long: number;
}

export interface MemorySettings {
  halfLifeDays: number;
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

/** Reads Ode's settings from the environment, loaded from the repo's .env (see .env.example). */
class EnvReader {
  private readonly missing: string[] = [];

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  optional(key: string): string {
    return this.env[key]?.trim() ?? "";
  }

  required(key: string): string {
    const value = this.optional(key);
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

export class OdeConfig {
  static readonly repoDir = fileURLToPath(new URL("../..", import.meta.url));

  private constructor(
    readonly host: string,
    readonly port: number,
    readonly bridgePort: number,
    readonly liveApp: string,
    readonly abletonUserLibrary: string,
    readonly userDir: string,
    readonly roles: Record<Role, RoleConfig>,
    readonly limits: AgentLimits,
    readonly liveTimeouts: LiveTimeouts,
    readonly memory: MemorySettings,
    readonly versions: VersionSettings,
    readonly release: ReleaseSettings,
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
    const metaKey = reader.optional("META_API_KEY");
    const roles = Object.fromEntries(
      ROLES.filter((role) => role !== "subagent").map((role) => [role, OdeConfig.readRole(reader, role, metaKey)]),
    ) as Record<Role, RoleConfig>;
    // The agent runtime talks to one endpoint, so subagents share the main agent's endpoint and key.
    roles.subagent = { ...roles.main, model: reader.required("ODE_SUBAGENT_MODEL") };
    // Live's default User Library folder depends on the system, so .env holds one for each.
    const userLibrary = process.platform === "win32" ? "ODE_ABLETON_USER_LIBRARY_WINDOWS" : "ODE_ABLETON_USER_LIBRARY_MACOS";
    const config = new OdeConfig(
      reader.required("ODE_HOST"),
      reader.number("ODE_PORT"),
      reader.number("ODE_BRIDGE_PORT"),
      reader.required("ODE_LIVE_APP"),
      reader.path(userLibrary),
      reader.path("ODE_USER_DIR"),
      roles,
      {
        subagentDepth: reader.number("ODE_SUBAGENT_DEPTH"),
        subagentsAtOnce: reader.number("ODE_SUBAGENTS_AT_ONCE"),
        budgetUsdPerRequest: reader.number("ODE_BUDGET_USD_PER_REQUEST"),
      },
      {
        normal: reader.number("ODE_LIVE_TIMEOUT_SECONDS") * 1000,
        long: reader.number("ODE_LIVE_LONG_TIMEOUT_SECONDS") * 1000,
      },
      {
        halfLifeDays: reader.number("ODE_MEMORY_HALF_LIFE_DAYS"),
        summaryMaxChars: reader.number("ODE_SUMMARY_MAX_CHARS"),
        mapMaxChars: reader.number("ODE_MAP_MAX_CHARS"),
      },
      {
        snapshotEvery: reader.number("ODE_VERSION_SNAPSHOT_EVERY"),
        groupMinutes: reader.number("ODE_VERSION_GROUP_MINUTES"),
      },
      { coverChoices: reader.number("ODE_COVER_ART_CHOICES") },
    );
    reader.assertComplete();
    return config;
  }

  /** The settings in .env.example, whatever the local .env says: what releases of Ode are built with. */
  static defaults(): OdeConfig {
    return OdeConfig.load(parse(readFileSync(join(OdeConfig.repoDir, ".env.example"), "utf8")));
  }

  private static readRole(reader: EnvReader, role: Role, metaKey: string): RoleConfig {
    const prefix = `ODE_${role.toUpperCase()}_`;
    const isMain = role === "main";
    const read = (key: string) => (isMain ? reader.required(prefix + key) : reader.optional(prefix + key));
    const provider = read("PROVIDER");
    const ownKey = reader.optional(`${prefix}API_KEY`);
    return {
      provider,
      baseUrl: read("BASE_URL"),
      apiKey: ownKey || (provider === "meta" ? metaKey : ""),
      model: read("MODEL"),
    };
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OdeConfig {
  return OdeConfig.load(env);
}
