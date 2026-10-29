import { config as loadDotenv } from "dotenv";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export class ConfigError extends Error {}

/**
 * Settings for working on Ode from its source, read from the repo's .env (see .env.example): where Live is, and the
 * folder that stands in for the extension's storage when tools run outside Live. These are for developers alone.
 */
export class DevConfig {
  static readonly repoDir = fileURLToPath(new URL("../..", import.meta.url));

  private constructor(
    /** The Live app that runs the extension during development. */
    readonly liveApp: string,
    /** Stands in for the extension's storage folder: the developer's own Settings live here. */
    readonly userDir: string,
    /** Ode's local server while the extension runs in Live, for the UI's development server; empty when unused. */
    readonly server: string,
  ) {}

  static load(env: NodeJS.ProcessEnv = process.env): DevConfig {
    loadDotenv({ path: join(DevConfig.repoDir, ".env"), quiet: true, processEnv: env });
    const missing = ["ODE_LIVE_APP", "ODE_USER_DIR"].filter((key) => !env[key]?.trim());
    if (missing.length > 0) throw new ConfigError(`Missing settings in .env (see .env.example): ${missing.join(", ")}`);
    const userDir = env.ODE_USER_DIR!.trim();
    return new DevConfig(
      env.ODE_LIVE_APP!.trim(),
      /^~[\\/]/.test(userDir) ? join(homedir(), userDir.slice(2)) : userDir,
      env.ODE_DEV_SERVER?.trim() ?? "",
    );
  }
}
