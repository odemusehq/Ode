import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DevConfig } from "../../shared/dev-config";
import { ExtensionBuild } from "./build";

/** Hands the extension to Ableton's extensions CLI: to run it in Live during development, or to package it as a .ablx. */
export class ExtensionLauncher {
  /** Stands in for the extension's temp folder while Ode runs from the source. */
  private static readonly DEV_TEMP = join(tmpdir(), "ode-dev");

  /** Builds the extension and runs it in the Live app named in .env, with the developer's folder as its storage. */
  static async develop(config: DevConfig): Promise<number> {
    await new ExtensionBuild(false).run();
    return ExtensionLauncher.cli(["run", "--live", config.liveApp, "--storage-directory", config.userDir, "--temp-directory", ExtensionLauncher.DEV_TEMP]);
  }

  /** Builds the extension for release and packages it at `file`, which Live installs from its Extensions page. */
  static async package(file: string): Promise<void> {
    await new ExtensionBuild(true).run();
    const code = await ExtensionLauncher.cli(["package", "-o", file]);
    if (code !== 0) throw new Error(`Ableton's extensions CLI stopped with code ${code} while packaging ${file}`);
  }

  private static cli(args: string[]): Promise<number> {
    const program = join(DevConfig.repoDir, "node_modules", ".bin", "ableton-extensions-cli");
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, { cwd: ExtensionBuild.outDir, stdio: "inherit" });
      child.once("error", (error) => reject(new Error(`Could not start Ableton's extensions CLI at ${program}: ${error.message}`)));
      child.once("exit", (code, signal) => resolve(code ?? (signal === null ? 0 : 1)));
    });
  }
}

if (import.meta.main) {
  process.exitCode = await ExtensionLauncher.develop(DevConfig.load());
}
