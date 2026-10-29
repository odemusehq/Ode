import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";
import defaults from "../shared/defaults.json";

/** Errors Windows gives while another program, such as a virus scanner or a sync client, holds a file for a moment. */
const BUSY_CODES: ReadonlySet<string> = new Set(["EPERM", "EACCES", "EBUSY"]);

export interface JsonFileOptions {
  /** Permissions for the file, such as 0o600 for a file only its owner reads. */
  mode?: number;
}

/** A JSON document on disk, validated on read, written atomically, with updates serialised. */
export class JsonFile<T> {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly path: string,
    private readonly schema: z.ZodType<T>,
    private readonly createDefault: () => T,
    private readonly options: JsonFileOptions = {},
  ) {}

  /** The document, or its default when the file is new; a damaged file is set aside and Ode carries on from the default. */
  async read(): Promise<T> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch (error) {
      if (JsonFile.isMissing(error)) return this.createDefault();
      throw error;
    }
    try {
      return this.schema.parse(JSON.parse(text));
    } catch (error) {
      await JsonFile.setAside(this.path, error);
      return this.createDefault();
    }
  }

  write(value: T): Promise<void> {
    return this.enqueue(() => JsonFile.writeAtomically(this.path, `${JSON.stringify(value, null, 2)}\n`, this.options.mode));
  }

  update(change: (current: T) => T): Promise<T> {
    return this.enqueue(async () => {
      const next = change(await this.read());
      await JsonFile.writeAtomically(this.path, `${JSON.stringify(next, null, 2)}\n`, this.options.mode);
      return next;
    });
  }

  /** True for the error a read gives when the file is absent. */
  static isMissing(error: unknown): boolean {
    return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
  }

  /** Moves a damaged file aside as <path>.unreadable-<time>, keeping it for the musician, so Ode carries on without it. */
  static async setAside(path: string, reason: unknown): Promise<void> {
    const aside = `${path}.unreadable-${Date.now()}`;
    await rename(path, aside).catch(() => undefined);
    console.error(`Ode set ${path} aside as ${aside}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }

  /**
   * Writes the text to a file of its own beside `path`, syncs it to disk, then renames it over `path`, so a reader
   * sees the old file or the new one whole. A rename that another program holds up is tried again for a moment.
   */
  static async writeAtomically(path: string, text: string, mode?: number): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    const file = await open(temporary, "w", mode);
    try {
      await file.writeFile(text, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    const { renameRetries, renameRetryMs } = defaults.storage;
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temporary, path);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code ?? "";
        if (!BUSY_CODES.has(code) || attempt >= renameRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, renameRetryMs * (attempt + 1)));
      }
    }
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
