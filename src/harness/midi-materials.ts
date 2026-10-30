import { createHash, randomUUID } from "node:crypto";
import type { Note } from "../shared/live";
import { MidiMaterialRefSchema, type MidiMaterialRef } from "../shared/midi-material";
import { NoteSchema } from "../tools/live/schemas";

type MaterialPath = (string | number)[];

export interface MidiMaterialOutput {
  path: MaterialPath;
  /** Only a native read or a complete replacement transform may carry its read lineage. */
  originReadTokens?: readonly string[];
}

export interface MidiMaterialCapture {
  result: unknown;
  outputs: readonly MidiMaterialOutput[];
  sourceTool: string;
  maxResultChars: number;
  signal?: AbortSignal;
}

export interface MidiMaterialLimits {
  maxMaterials?: number;
  maxNotes?: number;
  /** Combined serialized JSON bytes, not an estimate of JavaScript heap usage. */
  maxBytes?: number;
}

export interface MidiMaterialListInput { resultId?: string; offset?: number; limit?: number }
export interface MidiMaterialReadInput {
  id: string;
  section: "notes" | "metadata";
  offset?: number;
  limit?: number;
  expectedHash?: string;
}

interface Material {
  ref: MidiMaterialRef;
  notes: Note[];
  originReadTokens: string[];
  sourceTool: string;
  resultId: string;
  path: MaterialPath;
}

interface ResultMetadata { id: string; json: string; sha256: string }
const LIFETIME = "current-request";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const copy = <T>(value: T): T => structuredClone(value);
const fits = (value: unknown, limit: number) => JSON.stringify(value).length <= limit;

/** A small exact-material handoff, not a durable draft library or a record of current host state. */
export class MidiMaterials {
  private readonly scopes = new Set<MidiMaterialScope>();

  constructor(private readonly limits: MidiMaterialLimits = {}) {}

  begin(songId: string, exchangeId: string): MidiMaterialScope {
    const scope = new MidiMaterialScope(songId, exchangeId, this.limits);
    this.scopes.add(scope);
    return scope;
  }

  end(scope: MidiMaterialScope): void {
    scope.end();
    this.scopes.delete(scope);
  }
}

/** Shared by the main agent and its descendants, and explicitly expired on request completion or Stop. */
export class MidiMaterialScope {
  private active = true;
  private readonly materials = new Map<string, Material>();
  private readonly results = new Map<string, ResultMetadata>();
  private usedNotes = 0;
  private usedBytes = 0;
  private readonly bounds: Required<MidiMaterialLimits>;

  constructor(readonly songId: string, readonly exchangeId: string, limits: MidiMaterialLimits = {}) {
    if (!songId || !exchangeId) throw new Error("MIDI material needs its original song and request.");
    this.bounds = { maxMaterials: limits.maxMaterials ?? 512, maxNotes: limits.maxNotes ?? 100_000, maxBytes: limits.maxBytes ?? 16 * 1024 * 1024 };
    if (Object.values(this.bounds).some((value) => !Number.isSafeInteger(value) || value < 1)) throw new Error("MIDI material limits must be positive safe integers.");
  }

  get isActive(): boolean { return this.active; }

  assertActive(songId = this.songId, exchangeId = this.exchangeId): void {
    if (!this.active || songId !== this.songId || exchangeId !== this.exchangeId) {
      throw new Error("This MIDI material expired or belongs to another song/request. Read or compute the material again; old references are not durable drafts.");
    }
  }

  end(): void {
    this.active = false;
    this.materials.clear();
    this.results.clear();
    this.usedNotes = 0;
    this.usedBytes = 0;
  }

  /** Validate every declared output and its complete projected metadata before publishing any reference. */
  capture(input: MidiMaterialCapture): unknown {
    this.assertActive();
    input.signal?.throwIfAborted();
    if (!input.outputs.length) return input.result;
    if (!input.sourceTool || input.sourceTool.length > 200) throw new Error("MIDI material needs its actual source tool.");
    MidiMaterialScope.window(input.maxResultChars);
    if (this.materials.size + input.outputs.length > this.bounds.maxMaterials) throw new Error("This request's MIDI material store is full; no part of this result was retained.");
    const serialized = JSON.stringify(input.result);
    if (serialized === undefined) throw new Error("MIDI material needs a JSON tool result.");
    let projected: unknown = JSON.parse(serialized);
    const resultId = randomUUID();
    const staged: Material[] = [];
    const paths = new Set<string>();
    let noteCount = 0;
    let noteBytes = 0;
    for (const output of input.outputs) {
      MidiMaterialScope.path(output.path);
      const pathKey = JSON.stringify(output.path);
      if (paths.has(pathKey)) throw new Error("A MIDI output path was declared twice.");
      paths.add(pathKey);
      // Strict validation refuses unsupported fields instead of silently losing supplied performance material.
      const notes = NoteSchema.strict().array().parse(MidiMaterialScope.at(input.result, output.path));
      const json = JSON.stringify(notes);
      const tokens = [...new Set(output.originReadTokens ?? [])];
      if (tokens.length > 32 || tokens.some((token) => typeof token !== "string" || !token || token.length > 1000)) throw new Error("MIDI read lineage is too large or malformed.");
      const ref: MidiMaterialRef = { kind: "midi-material", id: randomUUID(), count: notes.length, sha256: hash(json) };
      staged.push({ ref, notes, originReadTokens: tokens, sourceTool: input.sourceTool, resultId, path: [...output.path] });
      noteCount += notes.length;
      noteBytes += Buffer.byteLength(json);
      projected = MidiMaterialScope.replace(projected, output.path, ref);
    }
    const metadata = JSON.stringify(projected);
    const metadataHash = hash(metadata);
    const bytes = noteBytes + Buffer.byteLength(metadata) + Buffer.byteLength(JSON.stringify(staged.map(MidiMaterialScope.descriptor)));
    if (this.usedNotes + noteCount > this.bounds.maxNotes || this.usedBytes + bytes > this.bounds.maxBytes) {
      throw new Error("This request's MIDI material store is full; no part of this result was retained.");
    }
    const details = { resultId, metadataHash, metadataLength: metadata.length, materialCount: staged.length, noteCount, lifetime: LIFETIME };
    const full = projected && typeof projected === "object" && !Array.isArray(projected)
      ? { ...projected, midiMaterials: details }
      : { result: projected, midiMaterials: details };
    let answer: unknown = full;
    if (!fits(full, input.maxResultChars)) {
      const top = staged.find((item) => item.path.length === 1 && item.path[0] === "notes");
      const selected: ReturnType<typeof MidiMaterialScope.descriptor>[] = [];
      const compact = () => ({ ...(top ? { notes: top.ref } : {}), midiMaterials: details, materials: selected });
      if (!fits(compact(), input.maxResultChars)) throw new Error("The tool result window is too small for an exact MIDI material reference; no result was retained.");
      for (const item of staged) {
        selected.push(MidiMaterialScope.descriptor(item));
        if (!fits(compact(), input.maxResultChars)) { selected.pop(); break; }
      }
      answer = compact();
    }
    input.signal?.throwIfAborted();
    this.assertActive();
    // No await occurs between final admission and publication, so capture is all-or-nothing.
    for (const material of staged) this.materials.set(material.ref.id, material);
    this.results.set(resultId, { id: resultId, json: metadata, sha256: metadataHash });
    this.usedNotes += noteCount;
    this.usedBytes += bytes;
    return copy(answer);
  }

  resolve(reference: MidiMaterialRef): { notes: Note[]; originReadTokens: string[] } {
    this.assertActive();
    const ref = MidiMaterialRefSchema.parse(reference);
    const item = this.materials.get(ref.id);
    if (!item || item.ref.count !== ref.count || item.ref.sha256 !== ref.sha256) throw new Error("That exact MIDI material reference is missing, changed or belongs to another request. Read or compute it again.");
    return { notes: copy(item.notes), originReadTokens: [...item.originReadTokens] };
  }

  list(input: MidiMaterialListInput = {}, maxChars = 60_000): unknown {
    this.assertActive();
    MidiMaterialScope.window(maxChars);
    const offset = MidiMaterialScope.offset(input.offset);
    const limit = MidiMaterialScope.limit(input.limit, 12, 100);
    if (input.resultId && !this.results.has(input.resultId)) throw new Error("That MIDI result is missing or expired.");
    const all = [...this.materials.values()].filter((item) => !input.resultId || item.resultId === input.resultId);
    if (offset > all.length) throw new Error("MIDI material offset is outside this list.");
    const items: ReturnType<typeof MidiMaterialScope.descriptor>[] = [];
    const page = () => ({ scope: { songId: this.songId, exchangeId: this.exchangeId, lifetime: LIFETIME },
      ...(input.resultId ? { resultId: input.resultId } : {}), total: all.length, offset,
      nextOffset: offset + items.length < all.length ? offset + items.length : null, items });
    for (const item of all.slice(offset, offset + limit)) {
      items.push(MidiMaterialScope.descriptor(item));
      if (!fits(page(), maxChars)) { items.pop(); break; }
    }
    if (!fits(page(), maxChars) || offset < all.length && !items.length) throw new Error("The tool result window is too small for one MIDI material descriptor.");
    return copy(page());
  }

  read(input: MidiMaterialReadInput, maxChars = 60_000): unknown {
    this.assertActive();
    MidiMaterialScope.window(maxChars);
    const item = this.materials.get(input.id);
    if (input.section === "notes") {
      if (!item) throw new Error("That MIDI material is missing or expired.");
      if (input.expectedHash && input.expectedHash !== item.ref.sha256) throw new Error("MIDI material hash changed; restart this read.");
      const offset = MidiMaterialScope.offset(input.offset);
      if (offset > item.notes.length) throw new Error("Note offset is outside this MIDI material.");
      const limit = MidiMaterialScope.limit(input.limit, 64, 512);
      const notes: Note[] = [];
      const page = () => ({ id: item.ref.id, section: "notes", unit: "note-index", sha256: item.ref.sha256,
        total: item.notes.length, offset, nextOffset: offset + notes.length < item.notes.length ? offset + notes.length : null, notes });
      for (const note of item.notes.slice(offset, offset + limit)) {
        notes.push(note);
        if (!fits(page(), maxChars)) { notes.pop(); break; }
      }
      if (!fits(page(), maxChars) || offset < item.notes.length && !notes.length) throw new Error("The tool result window is too small for one exact MIDI note.");
      return copy(page());
    }
    if (input.section !== "metadata") throw new Error("Choose notes or metadata for a MIDI material read.");
    const metadata = this.results.get(item?.resultId ?? input.id);
    if (!metadata) throw new Error("That MIDI result metadata is missing or expired.");
    const offset = MidiMaterialScope.offset(input.offset);
    if (offset > metadata.json.length) throw new Error("Metadata text offset is outside this result.");
    if (input.expectedHash && input.expectedHash !== metadata.sha256 || offset > 0 && input.expectedHash !== metadata.sha256) {
      throw new Error("Further metadata fragments require the exact whole metadata hash from the first read.");
    }
    const limit = MidiMaterialScope.limit(input.limit, 8192, 60_000);
    const page = (end: number) => ({ id: metadata.id, section: "metadata", unit: "json-character", offsetUnit: "UTF-16 code units in serialized JSON", sha256: metadata.sha256,
      total: metadata.json.length, offset, nextOffset: end < metadata.json.length ? end : null, text: metadata.json.slice(offset, end) });
    let low = offset, high = Math.min(metadata.json.length, offset + limit);
    // Admission includes JSON escaping of the fragment and the complete wrapper.
    if (fits(page(high), maxChars)) low = high;
    else while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(page(middle), maxChars)) low = middle;
      else high = middle - 1;
    }
    if (!fits(page(low), maxChars) || low === offset && offset < metadata.json.length) throw new Error("The tool result window is too small for one metadata character.");
    return page(low);
  }

  private static descriptor(item: Material) {
    return { path: [...item.path], ref: { ...item.ref }, originReadTokens: [...item.originReadTokens], sourceTool: item.sourceTool, resultId: item.resultId };
  }

  private static path(path: MaterialPath): void {
    if (path.length > 32 || path.some((part) => typeof part === "number" ? !Number.isSafeInteger(part) || part < 0
      : typeof part !== "string" || !part || part.length > 200 || ["__proto__", "constructor", "prototype"].includes(part))) throw new Error("Unsupported MIDI output path.");
  }

  private static at(value: unknown, path: MaterialPath): unknown {
    let current = value;
    for (const part of path) {
      if (!current || typeof current !== "object" || !Object.hasOwn(current, part)) throw new Error("A declared MIDI output path is missing.");
      current = (current as Record<string | number, unknown>)[part];
    }
    return current;
  }

  private static replace(value: unknown, path: MaterialPath, ref: MidiMaterialRef): unknown {
    if (!path.length) return ref;
    const parent = MidiMaterialScope.at(value, path.slice(0, -1));
    if (!parent || typeof parent !== "object") throw new Error("A declared MIDI output path is missing.");
    (parent as Record<string | number, unknown>)[path.at(-1)!] = ref;
    return value;
  }

  private static offset(value = 0): number {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("MIDI material offsets must be nonnegative integers.");
    return value;
  }

  private static limit(value: number | undefined, fallback: number, maximum: number): number {
    const limit = value ?? fallback;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("MIDI material page limits must be positive integers.");
    return Math.min(limit, maximum);
  }

  private static window(value: number): void {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("MIDI material result window must be a positive integer.");
  }
}
