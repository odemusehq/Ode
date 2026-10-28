import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadConfig, type OdeConfig } from "../../shared/config";
import { ExtensionBuild } from "./build";

/** Builds the extension and hands it to Ableton's extensions CLI: to run it in Live, or with --package to package it. */
export class ExtensionLauncher {
  /** The packaged extension (.ablx), which is installed by dropping it on the Extensions page of Live's settings. */
  static readonly packageFile = join(ExtensionBuild.directory, "dist", "Ode.ablx");

  constructor(private readonly config: OdeConfig) {}

  async start(packaging: boolean): Promise<number> {
    await new ExtensionBuild(this.config, packaging).run();
    return this.cli(packaging ? ["package", "-o", ExtensionLauncher.packageFile] : ["run", "--live", this.config.liveApp]);
  }

  private cli(args: string[]): Promise<number> {
    const program = join(this.config.repoDir, "node_modules", ".bin", "ableton-extensions-cli");
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, { cwd: ExtensionBuild.directory, stdio: "inherit" });
      child.once("error", (error) => reject(new Error(`Could not start Ableton's extensions CLI at ${program}: ${error.message}`)));
      child.once("exit", (code, signal) => resolve(code ?? (signal === null ? 0 : 1)));
    });
  }
}

if (import.meta.main) {
  process.exitCode = await new ExtensionLauncher(loadConfig()).start(process.argv.includes("--package"));
}
