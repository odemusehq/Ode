import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as vite from "vite";
import { ExtensionLauncher } from "../live/extension/run";
import { MaxDevice } from "../live/max/device";
import { DevConfig } from "../shared/dev-config";
import { Release } from "./release";

/** Builds the extension and its self-contained Max window device together in release/. */
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
    await writeFile(join(ReleasePackage.outDir, Release.device), await MaxDevice.build());
    return file;
  }
}

if (import.meta.main) {
  const release = process.argv[2] ? new Release(process.argv[2].replace(/^v/, "")) : await Release.read();
  console.log(`Release package: ${await new ReleasePackage(release).run()}`);
}
