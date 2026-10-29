import { createHash } from "node:crypto";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { JsonFile } from "./json-file";

/** One request and Ode's final reply to it. */
export const ExchangeSchema = z.object({ request: z.string(), reply: z.string(), at: z.string() });
export type Exchange = z.infer<typeof ExchangeSchema>;

/** A song's recent requests and replies, carried into its next request so the conversation goes on. */
export class ConversationLog {
  constructor(
    /** Names the conversation for model providers that keep it on one server. */
    readonly id: string,
    private readonly file: JsonFile<Exchange[]>,
    private readonly keep: number,
  ) {}

  recent(): Promise<Exchange[]> {
    return this.file.read();
  }

  async add(request: string, reply: string): Promise<void> {
    await this.file.update((exchanges) => [...exchanges, { request, reply, at: new Date().toISOString() }].slice(-this.keep));
  }
}

/** Every song's conversation, one JSON file per song in Ode's folder. */
export class ConversationStore {
  constructor(
    private readonly folder: string,
    private readonly keep: number,
  ) {}

  log(key: string): ConversationLog {
    return new ConversationLog(ConversationStore.id(key), new JsonFile(this.path(key), z.array(ExchangeSchema), () => []), this.keep);
  }

  /** Moves a song's conversation to its new key (the Set was saved for the first time or under a new name). */
  async rename(from: string, to: string): Promise<ConversationLog> {
    await rename(this.path(from), this.path(to)).catch(() => undefined);
    return this.log(to);
  }

  private path(key: string): string {
    return join(this.folder, `${ConversationStore.id(key)}.json`);
  }

  /** A file name for any key: song keys may be file paths. */
  private static id(key: string): string {
    return createHash("sha256").update(key).digest("hex").slice(0, 32);
  }
}
