import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, sep } from "node:path";

export interface UserPaths {
  root: string;
  preferences: string;
  artist: string;
  voice: string;
  songs: string;
  workspace: string;
}

export function userPaths(userDir: string): UserPaths {
  return {
    root: userDir,
    preferences: join(userDir, "Preferences"),
    artist: join(userDir, "Artist"),
    voice: join(userDir, "Voice"),
    songs: join(userDir, "Songs"),
    workspace: join(userDir, ".workspace"),
  };
}

/** Ode's folder for generated and rendered files: the extension's temp folder, which Live may clear between sessions. */
export class TempFolder {
  constructor(private readonly root: string) {}

  /** A fresh path for a file with this extension. */
  async file(extension: string): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const clean = extension.startsWith(".") ? extension : `.${extension}`;
    return join(this.root, `${randomUUID()}${clean}`);
  }

  /** A fresh, empty folder. */
  async folder(): Promise<string> {
    await mkdir(this.root, { recursive: true });
    return mkdtemp(join(this.root, "work-"));
  }

  /**
   * The file's real path when it lies inside this folder: renders and the files Ode generates live here, and they are
   * the files Ode reads by path. Throws for any other path.
   */
  async inside(path: string): Promise<string> {
    const [root, file] = await Promise.all([realpath(this.root), realpath(path).catch(() => "")]);
    if (file.startsWith(root + sep)) return file;
    throw new Error("Ode reads audio from its own renders and generated files: give a track with start and end, or a path a render returned.");
  }
}

