import { lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * The agent's working folder (never the musician's files). It exposes the repo's skills
 * where the agent runtime looks for project skills.
 */
export class Workspace {
  constructor(
    readonly root: string,
    readonly skillsSource: string,
  ) {}

  get skillsLink(): string {
    return join(this.root, ".claude", "skills");
  }

  async prepare(): Promise<string> {
    await mkdir(join(this.root, ".claude"), { recursive: true });
    await mkdir(this.skillsSource, { recursive: true });
    if (await this.linkPointsAt(this.skillsSource)) return this.root;
    await unlink(this.skillsLink).catch(() => undefined);
    await symlink(this.skillsSource, this.skillsLink, "dir");
    return this.root;
  }

  /** True when a path the agent wants to read is inside the skills folder. */
  isSkillFile(path: string): boolean {
    const target = resolve(this.root, path);
    return [this.skillsSource, this.skillsLink].some((base) => target.startsWith(`${resolve(base)}/`));
  }

  private async linkPointsAt(target: string): Promise<boolean> {
    try {
      const info = await lstat(this.skillsLink);
      return info.isSymbolicLink() && resolve(await readlink(this.skillsLink)) === resolve(target);
    } catch {
      return false;
    }
  }
}
