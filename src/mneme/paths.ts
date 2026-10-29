import { mkdir, mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

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
}

export async function ensureDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}
