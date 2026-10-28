import { join } from "node:path";

const UNSET_ROLES = ["AUDIO_UNDERSTANDING", "TRANSCRIPTION", "IMAGE_GENERATION", "STEM_SEPARATION", "SINGING_VOICE", "SOUND_GENERATION"];

/** A complete set of Ode settings for tests: every optional provider unset, nothing taken from the developer's .env. */
export function testEnv(userDir: string): NodeJS.ProcessEnv {
  const unset = Object.fromEntries(
    UNSET_ROLES.flatMap((role) => ["PROVIDER", "BASE_URL", "API_KEY", "MODEL"].map((field) => [`ODE_${role}_${field}`, ""])),
  );
  return {
    ...unset,
    ODE_HOST: "127.0.0.1",
    ODE_PORT: "8747",
    ODE_BRIDGE_PORT: "9878",
    ODE_USER_DIR: userDir,
    ODE_LIVE_APP: join(userDir, "Live.app"),
    ODE_ABLETON_USER_LIBRARY: join(userDir, "User Library"),
    META_API_KEY: "",
    ODE_MAIN_PROVIDER: "anthropic",
    ODE_MAIN_BASE_URL: "http://127.0.0.1:9",
    ODE_MAIN_API_KEY: "test-key",
    ODE_MAIN_MODEL: "test-model",
    ODE_SUBAGENT_MODEL: "test-model",
    ODE_LIVE_TIMEOUT_SECONDS: "15",
    ODE_LIVE_LONG_TIMEOUT_SECONDS: "300",
    ODE_MEMORY_HALF_LIFE_DAYS: "180",
    ODE_SUMMARY_MAX_CHARS: "2000",
    ODE_MAP_MAX_CHARS: "24000",
    ODE_VERSION_SNAPSHOT_EVERY: "20",
    ODE_VERSION_GROUP_MINUTES: "10",
    ODE_COVER_ART_CHOICES: "4",
    ODE_SUBAGENT_DEPTH: "2",
    ODE_SUBAGENTS_AT_ONCE: "6",
    ODE_BUDGET_USD_PER_REQUEST: "3",
  };
}
