import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, cp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import * as esbuild from "esbuild";
import * as vite from "vite";
import { DeviceBuilder } from "../live/device/build";
import { ExtensionLauncher } from "../live/extension/run";
import { OdeConfig } from "../shared/config";
import { Release } from "./release";

const run = promisify(execFile);

/** The parts of package.json a release keeps. */
interface PackageInfo {
  name: string;
  version: string;
  description: string;
  license: string;
  type: string;
  engines: Record<string, string>;
  dependencies: Record<string, string>;
}

/**
 * Builds a release of Ode in release/: a folder with the server, the built window, the skills, the Ode device, the
 * Ode Control Surface and the packaged Live extension, and its zip archive. In the unzipped folder the musician runs
 * `npm run setup` and then `npm start`.
 */
class ReleasePackage {
  static readonly outDir = join(OdeConfig.repoDir, "release");
  /** What the release takes from the repo, at the same paths: the server and what it reads, the setup and what it installs. */
  static readonly contents = [
    "LICENSE",
    ".env.example",
    "skills",
    "dist/ui",
    "src/agents",
    "src/harness",
    "src/mneme",
    "src/music",
    "src/server",
    "src/services",
    "src/shared",
    "src/tools",
    "src/live/bridge",
    "src/live/device",
    "src/packaging/setup.ts",
  ];
  /** Where the server and the setup start: the release must hold every file they import. */
  static readonly entryPoints = ["src/server/main.ts", "src/packaging/setup.ts"];
  /** The release's commands: setup installs the packages, then the Live parts; start runs Ode. */
  static readonly scripts = { setup: "npm ci && tsx src/packaging/setup.ts", start: "tsx src/server/main.ts" };

  private readonly folder: string;

  constructor(
    private readonly release: Release,
    private readonly config: OdeConfig,
  ) {
    this.folder = join(ReleasePackage.outDir, release.folder);
  }

  async run(): Promise<string> {
    await this.release.checkManifest();
    await this.build();
    await rm(ReleasePackage.outDir, { recursive: true, force: true });
    await this.copyContents();
    await this.checkImports();
    await this.writePackageFiles();
    await run("zip", ["-qrX", this.release.archive, this.release.folder], { cwd: ReleasePackage.outDir });
    return join(ReleasePackage.outDir, this.release.archive);
  }

  /** Builds the window, the packaged Live extension and the Ode device. */
  private async build(): Promise<void> {
    await vite.build({ configFile: join(OdeConfig.repoDir, "vite.config.ts"), logLevel: "warn" });
    const exitCode = await new ExtensionLauncher(this.config).start(true);
    if (exitCode !== 0) throw new Error(`Packaging the Live extension failed with exit code ${exitCode}`);
    await new DeviceBuilder(this.config).build();
  }

  private async copyContents(): Promise<void> {
    for (const path of ReleasePackage.contents) {
      await cp(join(OdeConfig.repoDir, path), join(this.folder, path), { recursive: true, filter: (source) => !ReleasePackage.isJunk(source) });
    }
    await copyFile(ExtensionLauncher.packageFile, join(this.folder, basename(ExtensionLauncher.packageFile)));
  }

  /** Fails when the server or the setup imports a file the release doesn't hold. */
  private async checkImports(): Promise<void> {
    const { metafile } = await esbuild.build({
      absWorkingDir: OdeConfig.repoDir,
      entryPoints: ReleasePackage.entryPoints,
      outdir: ReleasePackage.outDir,
      bundle: true,
      write: false,
      metafile: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    const missing = Object.keys(metafile.inputs).filter((input) => !existsSync(join(this.folder, input)));
    if (missing.length > 0) throw new Error(`The release lacks files the server or the setup imports: ${missing.join(", ")}`);
  }

  /** package.json with the release's commands and only the packages Ode runs with, and its lockfile. */
  private async writePackageFiles(): Promise<void> {
    const info = JSON.parse(await readFile(Release.packageFile, "utf8")) as PackageInfo;
    const { name, version, description, license, type, engines, dependencies } = info;
    const manifest = { name, version, private: true, description, license, type, engines, scripts: ReleasePackage.scripts, dependencies };
    await writeFile(join(this.folder, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await copyFile(join(OdeConfig.repoDir, "package-lock.json"), join(this.folder, "package-lock.json"));
    // npm drops the build-only packages from the copied lockfile and keeps every other version as it was locked.
    await run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: this.folder });
  }

  private static isJunk(path: string): boolean {
    return ["__pycache__", ".DS_Store"].includes(basename(path));
  }
}

if (import.meta.main) {
  const release = await Release.read();
  const tag = process.argv[2];
  if (tag !== undefined && tag !== release.tag) throw new Error(`The tag ${tag} doesn't match package.json, which says ${release.version}`);
  console.log(`Release package: ${await new ReleasePackage(release, OdeConfig.defaults()).run()}`);
}
