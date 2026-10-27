import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, type OdeConfig } from "../../shared/config";

interface Manifest {
  readonly entry: string;
}

/**
 * Bundles the extension into the single file Live loads. The server's host and port come from
 * Ode's configuration and are written into the bundle.
 */
export class ExtensionBuild {
  static readonly directory = import.meta.dirname;

  constructor(
    private readonly config: OdeConfig,
    private readonly production: boolean,
  ) {}

  async run(): Promise<void> {
    const manifest = JSON.parse(await readFile(join(ExtensionBuild.directory, "manifest.json"), "utf8")) as Manifest;
    await esbuild.build({
      entryPoints: [join(ExtensionBuild.directory, "extension.ts")],
      outfile: join(ExtensionBuild.directory, manifest.entry),
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node24",
      sourcesContent: false,
      logLevel: "info",
      minify: this.production,
      sourcemap: !this.production,
      define: {
        "process.env.ODE_HOST": JSON.stringify(this.config.host),
        "process.env.ODE_PORT": JSON.stringify(String(this.config.port)),
      },
    });
  }
}

if (import.meta.main) {
  await new ExtensionBuild(loadConfig(), process.argv.includes("--production")).run();
}
