import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dirname, join, parse } from "node:path";

export interface UserPaths {
  root: string;
  preferences: string;
  artist: string;
  voice: string;
  unsaved: string;
  workspace: string;
}

export function userPaths(userDir: string): UserPaths {
  return {
    root: userDir,
    preferences: join(userDir, "Preferences"),
    artist: join(userDir, "Artist"),
    voice: join(userDir, "Voice"),
    unsaved: join(userDir, "Unsaved"),
    workspace: join(userDir, ".workspace"),
  };
}

/** Ode's folder inside a Live project: <project>/Ode */
export function projectOdeDir(setFilePath: string): string {
  return join(dirname(setFilePath), "Ode");
}

/** One Set's data inside its project, so Sets sharing a project keep theirs apart: <project>/Ode/<Set file name without .als> */
export function projectSetDir(setFilePath: string): string {
  return join(projectOdeDir(setFilePath), parse(setFilePath).name);
}

const TEMP_ROOT = join(tmpdir(), "ode");

/** A fresh path in Ode's temp folder for generated or rendered files. */
export async function tempFile(extension: string): Promise<string> {
  await mkdir(TEMP_ROOT, { recursive: true });
  const clean = extension.startsWith(".") ? extension : `.${extension}`;
  return join(TEMP_ROOT, `${randomUUID()}${clean}`);
}

/** A fresh, empty folder in Ode's temp folder. */
export async function tempDir(): Promise<string> {
  await mkdir(TEMP_ROOT, { recursive: true });
  return mkdtemp(join(TEMP_ROOT, "work-"));
}

export async function ensureDir(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}
