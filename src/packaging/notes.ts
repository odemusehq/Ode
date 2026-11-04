import { execFile } from "node:child_process";
import { relative } from "node:path";
import { promisify } from "node:util";
import { DevConfig } from "../shared/dev-config";
import { Release } from "./release";

const run = promisify(execFile);

/** The notes of a release on GitHub: what changed since the previous release, and how to install it. */
export class ReleaseNotes {
  /** What npm version changes when it bumps the version (the manifest through the "version" script). */
  private static readonly versionFiles = ["package.json", "package-lock.json", relative(DevConfig.repoDir, Release.manifestFile)];

  constructor(private readonly release: Release) {}

  /** The notes, from the commits since the previous release (every commit, for the first one). */
  async write(): Promise<string> {
    return ReleaseNotes.format(this.release, await this.changes());
  }

  static format(release: Release, changes: readonly string[]): string {
    return [
      "## What changed",
      "",
      ...changes.map((change) => `- ${change}`),
      "",
      "## Requirements",
      "",
      "- The latest Ableton Live 12 Suite Beta on macOS or Windows, with Extensions enabled.",
      "- Max for Live, included with Suite, using Max 9.2 or later on macOS, or Max 9.1 or later on Windows.",
      "- Internet access and an API key for your chosen AI provider.",
      "",
      "## Installation",
      "",
      `1. Download the extension for your computer and \`${Release.device}\` from this release:`,
      `   - Apple silicon Mac: \`Ode-${release.version}-darwin-arm64.ablx\``,
      `   - Intel Mac: \`Ode-${release.version}-darwin-x64.ablx\``,
      `   - Windows: \`Ode-${release.version}-win32-x64.ablx\``,
      "2. In Live, open Settings → Extensions and drop the downloaded `.ablx` on the page. Developer Mode stays off. Confirm installation, save any open work, then restart Live when prompted.",
      `3. Drag \`${Release.device}\` onto an audio track or the Main track in your Set. Keep one Ode device per Set.`,
      "4. Click **Open Ode** on the device. In Settings, pick the provider and model, enter your key, and save.",
      "5. Chat with Ode in its floating window, or right-click a clip, track or time selection and choose **Ask Ode**. Results appear in Live.",
      "",
      "The extension is installed once. Load the Ode device in each Set where you want to use Ode; saving it in your default template makes it available in new Sets.",
      "",
      "On macOS, Max 9.2 fixes Command-key editing shortcuts in the embedded window. If Live bundles an older version, install the current Max from https://cycling74.com/downloads, select Max.app under Live Settings → File & Folder → Max Application → Browse, then restart Live. No Max Console setup is required. The vendor fix is listed at https://cycling74.com/releases/max/9.2.0.",
      "",
      "If an older Ode extension is already installed, uninstall its entry in Settings → Extensions before installing this version. Live currently refuses installation over an existing extension folder.",
      "",
    ].join("\n");
  }

  /** The subject of each commit in the release, newest first, leaving out the commit that only bumped the version. */
  private async changes(): Promise<string[]> {
    const previous = await this.previousTag();
    const range = previous ? `${previous}..${this.release.tag}` : this.release.tag;
    const commits = (await this.git("log", "--no-merges", "--format=%H %s", range)).split("\n").filter(Boolean);
    const bump = await this.bumpCommit();
    return commits.filter((line) => bump === null || !line.startsWith(bump)).map((line) => line.slice(line.indexOf(" ") + 1));
  }

  private async previousTag(): Promise<string | null> {
    try {
      return await this.git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", `${this.release.tag}^`);
    } catch {
      return null;
    }
  }

  /** The tagged commit when it only changes the version, as npm version makes it; otherwise null. */
  private async bumpCommit(): Promise<string | null> {
    const commit = await this.git("rev-list", "-n", "1", this.release.tag);
    const files = (await this.git("diff-tree", "--no-commit-id", "--name-only", "-r", commit)).split("\n").filter(Boolean);
    return files.length > 0 && files.every((file) => ReleaseNotes.versionFiles.includes(file)) ? commit : null;
  }

  private async git(...args: string[]): Promise<string> {
    const { stdout } = await run("git", args, { cwd: DevConfig.repoDir });
    return stdout.trim();
  }
}

if (import.meta.main) {
  process.stdout.write(await new ReleaseNotes(await Release.read()).write());
}
