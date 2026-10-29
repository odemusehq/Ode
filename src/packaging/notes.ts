import { execFile } from "node:child_process";
import { relative } from "node:path";
import { promisify } from "node:util";
import { OdeConfig } from "../shared/config";
import { Release } from "./release";

const run = promisify(execFile);

/** The notes of a release on GitHub: what changed since the previous release, and how to install it. */
export class ReleaseNotes {
  /** What npm version changes when it bumps the version (the manifest through the "version" script). */
  private static readonly versionFiles = ["package.json", "package-lock.json", relative(OdeConfig.repoDir, Release.manifestFile)];

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
      "## Install",
      "",
      `Ode needs macOS or Windows, Node.js ${release.node} or later and Ableton Live 12 Suite. Live extensions are only in the Live beta for now.`,
      "",
      `1. Unzip ${release.archive}, open a terminal in the ${release.folder} folder and run \`npm run setup\`. It adds the Ode device and the Ode Control Surface to your User Library and makes \`.env\`.`,
      "2. Add your model keys to `.env` and save it; `.env.example` describes each one.",
      "3. In Live, drop `Ode.ablx` on Settings → Extensions (leave Developer Mode off), choose Ode as a Control Surface in Settings → Link, Tempo & MIDI, and put the Ode device on the Main track.",
      "4. Run `npm start` in the folder whenever you use Ode.",
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
    const { stdout } = await run("git", args, { cwd: OdeConfig.repoDir });
    return stdout.trim();
  }
}

if (import.meta.main) {
  process.stdout.write(await new ReleaseNotes(await Release.read()).write());
}
