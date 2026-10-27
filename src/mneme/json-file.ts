import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/** A JSON document on disk, validated on read, written atomically, with updates serialised. */
export class JsonFile<T> {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly path: string,
    private readonly schema: z.ZodType<T>,
    private readonly createDefault: () => T,
  ) {}

  async read(): Promise<T> {
    try {
      const text = await readFile(this.path, "utf8");
      return this.schema.parse(JSON.parse(text));
    } catch (error) {
      if (isMissingFile(error)) return this.createDefault();
      throw error;
    }
  }

  write(value: T): Promise<void> {
    return this.enqueue(() => this.writeNow(value));
  }

  update(change: (current: T) => T): Promise<T> {
    return this.enqueue(async () => {
      const next = change(await this.read());
      await this.writeNow(next);
      return next;
    });
  }

  private async writeNow(value: T): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, this.path);
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
