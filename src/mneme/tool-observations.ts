import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { JsonFile } from "./json-file";
import type { SongStore } from "./song-store";

const EXCERPT_CHARS = 4_000;
const Text = z.string().min(1).max(1_000);
const ToolObservationSchema = z.object({
  version: z.literal(1),
  songId: Text,
  exchangeId: Text,
  toolCallId: Text,
  name: Text,
  ok: z.boolean(),
  at: z.iso.datetime(),
  targets: z.array(z.string().min(1).max(200)).max(128),
  targetScope: z.enum(["inferred", "explicit"]).default("inferred"),
  input: z.unknown().optional(),
  resultHash: z.string().regex(/^[a-f0-9]{64}$/),
  resultLength: z.number().int().min(0),
  excerpt: z.string().max(EXCERPT_CHARS),
  truncated: z.boolean(),
});
export type ToolObservation = z.infer<typeof ToolObservationSchema>;

export interface ToolObservationInput {
  exchangeId: string;
  toolCallId: string;
  name: string;
  /** The tool's validated arguments, with secrets removed before storage. */
  input: unknown;
  ok: boolean;
  /** The actual full tool result; only its hash, length and redacted excerpt are kept. */
  text: string;
  /** Trusted tool-definition scope, replacing inference from requested/result tags when present. */
  targets?: readonly string[];
}

interface SongObservations { songId: string; dir: string }

/** Immutable citations to actual tool outcomes. A receipt does not establish artistic quality or currentness. */
export class ToolObservations {
  private readonly files = new Map<string, JsonFile<ToolObservation[]>>();

  constructor(private readonly song: Pick<SongStore, "songId" | "dataDir">) {}

  record(input: ToolObservationInput): Promise<ToolObservation> {
    const song = this.current();
    const parsedResult = ToolObservations.json(input.text);
    const redacted = ToolObservations.redact(parsedResult ?? input.text);
    const resultText = typeof redacted === "string" ? redacted : JSON.stringify(redacted);
    const targets = new Set<string>();
    if (input.targets !== undefined) {
      for (const target of input.targets) ToolObservations.addTarget(targets, target);
    } else {
      ToolObservations.targets(input.input, targets);
      ToolObservations.targets(parsedResult, targets);
    }
    const observation = ToolObservationSchema.parse({
      version: 1,
      songId: song.songId,
      exchangeId: input.exchangeId,
      toolCallId: input.toolCallId,
      name: input.name,
      ok: input.ok,
      at: new Date().toISOString(),
      targets: [...targets].sort(),
      targetScope: input.targets === undefined ? "inferred" : "explicit",
      input: ToolObservations.redact(input.input),
      resultHash: createHash("sha256").update(input.text).digest("hex"),
      resultLength: input.text.length,
      excerpt: resultText.slice(0, EXCERPT_CHARS),
      truncated: resultText.length > EXCERPT_CHARS,
    });
    let saved = observation;
    return this.file(song, input.exchangeId).update((entries) => {
      const previous = entries.find((entry) => entry.toolCallId === input.toolCallId);
      if (previous) {
        // A retried disk receipt may be identical; a citation must never be repointed at different work.
        const { at: _oldTime, ...old } = previous;
        const { at: _newTime, ...next } = observation;
        if (JSON.stringify(old) !== JSON.stringify(next)) throw new Error("That tool observation already exists and is immutable.");
        saved = previous;
        return entries;
      }
      return [...entries, observation];
    }).then(() => saved);
  }

  async find(exchangeId: string, toolCallId: string): Promise<ToolObservation | null> {
    const song = this.current();
    const entries = await this.file(song, exchangeId).read();
    return entries.find((entry) => entry.songId === song.songId && entry.exchangeId === exchangeId && entry.toolCallId === toolCallId) ?? null;
  }

  /** A bounded display window; the source observations on disk are retained in full. */
  async recent(limit = 12): Promise<ToolObservation[]> {
    const song = this.current();
    const count = Math.max(0, Math.min(100, Math.floor(limit)));
    if (!count) return [];
    let names: string[];
    try { names = (await readdir(song.dir)).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)); }
    catch (error) { if (JsonFile.isMissing(error)) return []; throw error; }
    const dated = await Promise.all(names.map(async (name) => ({ path: join(song.dir, name), time: (await stat(join(song.dir, name))).mtimeMs })));
    dated.sort((left, right) => right.time - left.time);
    const entries = await Promise.all(dated.slice(0, count).map(({ path }) => this.fileAt(path).read()));
    return entries.flat().filter((entry) => entry.songId === song.songId).sort((left, right) => right.at.localeCompare(left.at)).slice(0, count);
  }

  private current(): SongObservations {
    const songId = this.song.songId;
    const dir = this.song.dataDir;
    if (!songId || !dir) throw new Error("Open an Ode song before saving tool observations.");
    return { songId, dir: join(dir, "tool-observations") };
  }

  private file(song: SongObservations, exchangeId: string): JsonFile<ToolObservation[]> {
    if (!exchangeId || exchangeId.length > 1_000) throw new Error("A tool observation needs its exchange id.");
    const id = createHash("sha256").update(exchangeId).digest("hex");
    return this.fileAt(join(song.dir, `${id}.json`));
  }

  private fileAt(path: string): JsonFile<ToolObservation[]> {
    const file = this.files.get(path) ?? new JsonFile(path, z.array(ToolObservationSchema), () => []);
    this.files.set(path, file);
    return file;
  }

  private static json(text: string): unknown {
    try { return JSON.parse(text); } catch { return undefined; }
  }

  private static addTarget(targets: Set<string>, target: unknown): void {
    if (typeof target !== "string" || targets.size >= 128) return;
    const tag = target.trim();
    if (tag && tag.length <= 200) targets.add(tag);
  }

  /** Only explicit canonical tag fields are inferred; positional references never become stable tags. */
  private static targets(value: unknown, found: Set<string>, seen = new Set<object>()): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) this.targets(item, found, seen); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === "tag") this.addTarget(found, child);
      else this.targets(child, found, seen);
    }
  }

  private static redact(value: unknown, seen = new Set<object>()): unknown {
    if (typeof value === "string") return value
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted]")
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
      .replace(/((?:api[_-]?key|authorization|password|secret|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[redacted]");
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => this.redact(item, seen));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
      /^(?:apikey|key|authorization|auth|accesstoken|refreshtoken|token|password|secret|clientsecret|credentials?)$/.test(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
        ? "[redacted]" : this.redact(child, seen),
    ]));
  }
}
