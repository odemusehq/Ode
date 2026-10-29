import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/**
 * Ode's text files (the agents' prompts and the skills), by their path in the repo with forward slashes:
 * "src/agents/ode.md", "skills/rhymes/pop/SKILL.md".
 */
export interface TextLibrary {
  read(path: string): Promise<string>;
  /** Every path under a folder, such as "skills/". */
  list(folder: string): Promise<string[]>;
}

/** The texts read from the repo folder, for tools that run from the source. */
export class FolderTexts implements TextLibrary {
  constructor(private readonly root: string) {}

  read(path: string): Promise<string> {
    return readFile(join(this.root, ...path.split("/")), "utf8");
  }

  async list(folder: string): Promise<string[]> {
    const base = join(this.root, ...folder.split("/").filter(Boolean));
    const entries = await readdir(base, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => relative(this.root, join(entry.parentPath, entry.name)).split(sep).join("/"));
  }
}

/** The texts bundled into the extension at build time. */
export class BundledTexts implements TextLibrary {
  constructor(private readonly files: Readonly<Record<string, string>>) {}

  async read(path: string): Promise<string> {
    const text = this.files[path];
    if (text === undefined) throw new Error(`${path} is outside Ode's bundled texts.`);
    return text;
  }

  async list(folder: string): Promise<string[]> {
    return Object.keys(this.files).filter((path) => path.startsWith(folder));
  }
}
