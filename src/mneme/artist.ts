import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { ArtistFact, Evidence, Habit, MemoryKind, MemoryScope } from "../shared/memory";
import { JsonFile } from "./json-file";
import type { UserPaths } from "./paths";
import type { MemorySettings } from "../shared/config";

const EvidenceSchema = z.object({
  song: z.string().optional(), note: z.string(), time: z.string(),
  exchangeId: z.string().optional(), toolCallId: z.string().optional(),
  authorship: z.enum(["artist", "ode", "mixed", "unknown"]).optional(),
});
const FactSchema = z.object({
  id: z.string(),
  scope: z.enum(["artist", "song"]).default("artist"),
  kind: z.enum(["preference", "material"]).default("preference"),
  songId: z.string().optional(),
  context: z.string().optional(),
  topic: z.string(),
  value: z.string(),
  source: z.enum(["said", "noticed"]),
  confidence: z.number(),
  evidence: z.array(EvidenceSchema),
  updated: z.string(),
});
const HabitSchema = z.object({
  name: z.string(), songId: z.string().optional(), context: z.string().optional(), note: z.string().optional(),
  exchangeIds: z.array(z.string()).optional(), kept: z.number(), rejected: z.number(), updated: z.string(),
});
const RememberedSongSchema = z.object({
  songId: z.string(), title: z.string(), lyrics: z.array(z.string()), updated: z.string(),
});
const MAX_EVIDENCE = 32;

/** A song as Mneme remembers it, for comparing the artist's songs with each other. */
export type RememberedSong = z.infer<typeof RememberedSongSchema>;

export interface NewFact {
  /** An existing record to correct. Omit this to create or merge an identical fact. */
  id?: string;
  scope?: MemoryScope;
  kind?: MemoryKind;
  songId?: string;
  /** null clears an existing context; omission retains it during a correction. */
  context?: string | null;
  topic: string;
  value: string;
  source: ArtistFact["source"];
  confidence?: number;
  evidence?: Omit<Evidence, "time">;
}

export interface HabitStrength {
  name: string;
  scope: MemoryScope;
  songId?: string;
  context?: string;
  note?: string;
  /** 0..1: how often suggestions of this kind were kept, weighted towards recent outcomes. */
  preference: number;
  /** Weighted number of outcomes behind the preference. */
  outcomes: number;
}

/** Mneme: what Ode knows about the artist, kept in the user folder. */
export class Mneme {
  private readonly facts: JsonFile<ArtistFact[]>;
  private readonly habitsFile: JsonFile<Habit[]>;
  private readonly songs: JsonFile<RememberedSong[]>;

  constructor(
    paths: UserPaths,
    private readonly settings: MemorySettings,
  ) {
    this.facts = new JsonFile(join(paths.artist, "facts.json"), z.array(FactSchema), () => []);
    this.habitsFile = new JsonFile(join(paths.artist, "habits.json"), z.array(HabitSchema), () => []);
    this.songs = new JsonFile(join(paths.artist, "songs.json"), z.array(RememberedSongSchema), () => []);
  }

  /** Current song first, then explicit preferences; inferred facts fade with age. */
  async recall(topic?: string, options: { songId?: string; includeOtherSongs?: boolean; kind?: MemoryKind } = {}): Promise<ArtistFact[]> {
    const needle = topic?.trim().toLowerCase();
    const facts = (await this.facts.read()).map((fact) => ({ ...fact, confidence: this.currentConfidence(fact) }));
    return facts
      .filter((fact) => (!options.songId || options.includeOtherSongs || fact.scope === "artist" || fact.songId === options.songId)
        && (!options.kind || fact.kind === options.kind)
        && (!needle || [fact.topic, fact.value, fact.context].some((text) => text?.toLowerCase().includes(needle))))
      .sort((a, b) => Number(b.scope === "song" && b.songId === options.songId) - Number(a.scope === "song" && a.songId === options.songId)
        || Number(b.source === "said") - Number(a.source === "said")
        || b.confidence - a.confidence || Date.parse(b.updated) - Date.parse(a.updated));
  }

  async record(input: NewFact, signal?: AbortSignal): Promise<ArtistFact> {
    signal?.throwIfAborted();
    const now = new Date().toISOString();
    const id = optionalText(input.id, "id", 200);
    const inputSongId = optionalText(input.songId, "songId", 200);
    const inputContext = input.context === null ? undefined : optionalText(input.context, "context", 2000);
    const topic = text(input.topic, "topic", 200).replace(/\s+/g, " ");
    const value = text(input.value, "value", 8000);
    const evidence = input.evidence ? normaliseEvidence(input.evidence, now) : undefined;
    if (input.source === "noticed" && !evidence?.note) throw new Error("Noticed memory requires a nonempty evidence note.");
    const requestedConfidence = input.confidence ?? this.settings.unratedConfidence;
    if (!Number.isFinite(requestedConfidence)) throw new Error("Memory confidence must be a finite number.");
    let saved: ArtistFact | undefined;
    await this.facts.update((facts) => {
      signal?.throwIfAborted();
      const existing = id ? facts.find((fact) => fact.id === id) : undefined;
      if (id && !existing) throw new Error(`Memory record ${id} was not found.`);
      const scope = input.scope ?? existing?.scope ?? (inputSongId ? "song" : "artist");
      const songId = scope === "artist" ? undefined : inputSongId ?? existing?.songId;
      if (scope === "song" && !songId) throw new Error("Song memory requires a songId.");
      const kind = input.kind ?? existing?.kind ?? "preference";
      const context = input.context === undefined ? existing?.context : inputContext;
      if (input.source === "noticed" && kind === "preference" && evidence?.authorship === "ode") {
        throw new Error("Ode-authored material is not evidence of the artist's preferences; record it as material instead.");
      }
      const tentative = input.source === "noticed" && kind === "preference" && evidence?.authorship !== "artist";
      const confidence = input.source === "said" ? 1 : Math.min(tentative ? 0.5 : 1, Math.max(0, requestedConfidence));
      const meaning = { scope, kind, songId, context, topic, value };
      const match = existing ?? facts.find((fact) => sameMeaning(fact, meaning));
      if (match?.source === "said" && input.source === "noticed") {
        throw new Error("A noticed claim cannot overwrite a preference the artist said explicitly.");
      }
      const addedEvidence = evidence && !match?.evidence.some((old) => evidenceKey(old) === evidenceKey(evidence));
      const changed = match && (!sameMeaning(match, meaning) || match.source !== input.source
        || (!!id && (match.topic !== topic || match.value !== value || match.context !== context)));
      const confidenceCorrection = id && input.confidence !== undefined && match?.confidence !== confidence;
      if (match && !changed && !confidenceCorrection && !addedEvidence) {
        saved = match;
        return facts;
      }
      saved = {
        id: match?.id ?? randomUUID(), ...meaning, source: input.source,
        confidence: input.source === "said" ? 1 : changed || confidenceCorrection ? confidence : Math.max(match ? this.currentConfidence(match) : 0, confidence),
        evidence: mergeEvidence(match?.evidence ?? [], evidence), updated: now,
      };
      return match ? facts.map((fact) => (fact.id === match.id ? saved! : fact)) : [...facts, saved];
    });
    return saved!;
  }

  async forget(id: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted();
    let removed = false;
    await this.facts.update((facts) => {
      signal?.throwIfAborted();
      removed = facts.some((fact) => fact.id === id);
      return facts.filter((fact) => fact.id !== id);
    });
    return removed;
  }

  async noteOutcome(name: string, kept: boolean, options: { songId?: string; context?: string; exchangeId?: string; note?: string; signal?: AbortSignal } = {}): Promise<Habit> {
    options.signal?.throwIfAborted();
    const now = new Date().toISOString();
    name = text(name, "habit", 200).replace(/\s+/g, " ");
    const songId = optionalText(options.songId, "songId", 200);
    const context = optionalText(options.context, "context", 2000);
    const exchangeId = optionalText(options.exchangeId, "exchangeId", 200);
    const note = optionalText(options.note, "note", 2000);
    let saved: Habit | undefined;
    await this.habitsFile.update((habits) => {
      options.signal?.throwIfAborted();
      const current = habits.find((habit) => canonical(habit.name) === canonical(name)
        && habit.songId === songId && canonical(habit.context) === canonical(context));
      if (current && exchangeId && current.exchangeIds?.includes(exchangeId)) {
        saved = current;
        return habits;
      }
      const decay = current ? this.decay(current.updated) : 1;
      saved = {
        name: current?.name ?? name, songId, context, ...(note || current?.note ? { note: note ?? current?.note } : {}),
        ...(exchangeId || current?.exchangeIds ? { exchangeIds: [...(current?.exchangeIds ?? []), ...(exchangeId ? [exchangeId] : [])] } : {}),
        kept: (current?.kept ?? 0) * decay + (kept ? 1 : 0),
        rejected: (current?.rejected ?? 0) * decay + (kept ? 0 : 1), updated: now,
      };
      return current ? habits.map((habit) => (habit === current ? saved! : habit)) : [...habits, saved];
    });
    return saved!;
  }

  async habitStrengths(options: { songId?: string; includeOtherSongs?: boolean } = {}): Promise<HabitStrength[]> {
    const habits = await this.habitsFile.read();
    return habits
      .filter((habit) => !options.songId || options.includeOtherSongs || !habit.songId || habit.songId === options.songId)
      .map((habit): HabitStrength => {
        const decay = this.decay(habit.updated);
        const kept = habit.kept * decay;
        const rejected = habit.rejected * decay;
        // Beta(1, 1) prior: with zero outcomes the preference is neutral (0.5).
        return {
          name: habit.name, scope: habit.songId ? "song" : "artist", songId: habit.songId, context: habit.context, note: habit.note,
          preference: (kept + 1) / (kept + rejected + 2), outcomes: kept + rejected,
        };
      })
      .sort((a, b) => Number(b.songId === options.songId && !!b.songId) - Number(a.songId === options.songId && !!a.songId) || b.outcomes - a.outcomes);
  }

  async rememberSong(entry: Omit<RememberedSong, "updated">): Promise<void> {
    const updated = new Date().toISOString();
    await this.songs.update((songs) => [...songs.filter((song) => song.songId !== entry.songId), { ...entry, updated }]);
  }

  /** The lyrics of every song but the one given, so a song is compared with the artist's other songs. */
  async pastLyrics(excludeSongId: string): Promise<string[]> {
    const songs = await this.songs.read();
    return songs.filter((song) => song.songId !== excludeSongId).flatMap((song) => song.lyrics);
  }

  private currentConfidence(fact: ArtistFact): number {
    return fact.source === "said" ? 1 : Number((fact.confidence * this.decay(fact.updated)).toFixed(3));
  }

  private decay(since: string): number {
    const ageDays = (Date.now() - Date.parse(since)) / 86_400_000;
    return ageDays <= 0 ? 1 : 0.5 ** (ageDays / this.settings.halfLifeDays);
  }
}

function text(value: string, label: string, max: number): string {
  const clean = value.trim();
  if (!clean) throw new Error(`Memory ${label} must not be empty.`);
  if (clean.length > max) throw new Error(`Memory ${label} is too long (maximum ${max} characters).`);
  return clean;
}

function optionalText(value: string | undefined, label: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, label, max);
}

function canonical(value?: string): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sameMeaning(a: Pick<ArtistFact, "scope" | "kind" | "songId" | "context" | "topic" | "value">, b: typeof a): boolean {
  return a.scope === b.scope && a.kind === b.kind && a.songId === b.songId
    && canonical(a.context) === canonical(b.context) && canonical(a.topic) === canonical(b.topic) && canonical(a.value) === canonical(b.value);
}

function normaliseEvidence(evidence: Omit<Evidence, "time">, time: string): Evidence {
  return {
    note: text(evidence.note, "evidence note", 2000), time,
    song: optionalText(evidence.song, "evidence song", 500),
    exchangeId: optionalText(evidence.exchangeId, "exchangeId", 200),
    toolCallId: optionalText(evidence.toolCallId, "toolCallId", 200),
    authorship: evidence.authorship ?? "unknown",
  };
}

function evidenceKey(evidence: Evidence): string {
  // The memory-writing call is provenance, not a new independent observation.
  return JSON.stringify([canonical(evidence.song), canonical(evidence.note), evidence.exchangeId, evidence.authorship ?? "unknown"]);
}

function mergeEvidence(previous: Evidence[], added?: Evidence): Evidence[] {
  const unique = new Map<string, Evidence>();
  for (const evidence of [...previous, ...(added ? [added] : [])]) {
    const key = evidenceKey(evidence);
    if (!unique.has(key)) unique.set(key, evidence);
  }
  return [...unique.values()].slice(-MAX_EVIDENCE);
}
