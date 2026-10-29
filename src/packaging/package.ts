import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import * as vite from "vite";
import { ExtensionLauncher } from "../live/extension/run";
import { DevConfig } from "../shared/dev-config";
import { Release } from "./release";

/** Builds a release of Ode in release/: the UI, then the extension with all of Ode inside it, as one .ablx file. */
class ReleasePackage {
  static readonly outDir = join(DevConfig.repoDir, "release");

  constructor(private readonly release: Release) {}

  async run(): Promise<string> {
    await this.release.checkManifest();
    await rm(ReleasePackage.outDir, { recursive: true, force: true });
    await mkdir(ReleasePackage.outDir, { recursive: true });
    await vite.build({ configFile: join(DevConfig.repoDir, "vite.config.ts"), logLevel: "warn" });
    const file = join(ReleasePackage.outDir, this.release.extension);
    await ExtensionLauncher.package(file);
    return file;
  }
}

if (import.meta.main) {
  const release = process.argv[2] ? new Release(process.argv[2].replace(/^v/, "")) : await Release.read();
  console.log(`Release package: ${await new ReleasePackage(release).run()}`);
}
