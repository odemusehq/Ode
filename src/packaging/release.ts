import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ExtensionBuild } from "../live/extension/build";
import { OdeConfig } from "../shared/config";

interface PackageInfo {
  version: string;
  engines: { node: string };
}

interface ExtensionManifest {
  version: string;
}

/** A release of Ode: its version and tag, the Node.js it needs and the names of the files it ships. */
export class Release {
  static readonly packageFile = join(OdeConfig.repoDir, "package.json");
  static readonly manifestFile = join(ExtensionBuild.directory, "manifest.json");

  constructor(
    readonly version: string,
    /** The oldest Node.js version Ode runs on. */
    readonly node: string,
  ) {}

  /** The release package.json describes. */
  static async read(): Promise<Release> {
    const info = JSON.parse(await readFile(Release.packageFile, "utf8")) as PackageInfo;
    return new Release(info.version, info.engines.node.replace(/^\D+/, ""));
  }

  get tag(): string {
    return `v${this.version}`;
  }

  /** The folder the archive unpacks to. */
  get folder(): string {
    return `Ode-${this.version}`;
  }

  get archive(): string {
    return `${this.folder}.zip`;
  }

  /** Checks that the Live extension's manifest has this version too. */
  async checkManifest(): Promise<void> {
    const { version } = await Release.manifest();
    if (version !== this.version) {
      throw new Error(`The Live extension's manifest says ${version} and package.json says ${this.version}: change versions with npm version`);
    }
  }

  /** Writes this version into the Live extension's manifest. */
  async writeManifest(): Promise<void> {
    const manifest = await Release.manifest();
    await writeFile(Release.manifestFile, `${JSON.stringify({ ...manifest, version: this.version }, null, 2)}\n`, "utf8");
  }

  private static async manifest(): Promise<ExtensionManifest> {
    return JSON.parse(await readFile(Release.manifestFile, "utf8")) as ExtensionManifest;
  }
}
