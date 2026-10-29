import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { ArtistFact, Evidence, Habit } from "../shared/memory";
import { JsonFile } from "./json-file";
import type { UserPaths } from "./paths";
import type { MemorySettings } from "../shared/config";

const EvidenceSchema = z.object({ song: z.string().optional(), note: z.string(), time: z.string() });
const FactSchema = z.object({
  id: z.string(),
  topic: z.string(),
  value: z.string(),
  source: z.enum(["said", "noticed"]),
  confidence: z.number(),
  evidence: z.array(EvidenceSchema),
  updated: z.string(),
});
const HabitSchema = z.object({ name: z.string(), kept: z.number(), rejected: z.number(), updated: z.string() });
const RememberedSongSchema = z.object({
  songId: z.string(),
  title: z.string(),
  lyrics: z.array(z.string()),
  updated: z.string(),
});

/** A song as Mneme remembers it, for comparing the artist's songs with each other. */
export type RememberedSong = z.infer<typeof RememberedSongSchema>;

export interface NewFact {
  topic: string;
  value: string;
  source: ArtistFact["source"];
  confidence?: number;
  evidence?: Omit<Evidence, "time">;
}

export interface HabitStrength {
  name: string;
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

  /** Facts, strongest first; facts Ode noticed fade with age. */
  async recall(topic?: string): Promise<ArtistFact[]> {
    const needle = topic?.toLowerCase();
    const facts = (await this.facts.read()).map((fact) => ({ ...fact, confidence: this.currentConfidence(fact) }));
    return facts
      .filter((fact) => !needle || fact.topic.toLowerCase().includes(needle) || fact.value.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.source === "said") - Number(a.source === "said") || b.confidence - a.confidence);
  }

  async record(input: NewFact): Promise<ArtistFact> {
    const now = new Date().toISOString();
    const evidence: Evidence[] = input.evidence ? [{ ...input.evidence, time: now }] : [];
    const confidence = input.source === "said" ? 1 : Math.min(1, Math.max(0, input.confidence ?? this.settings.unratedConfidence));
    let saved: ArtistFact | undefined;
    await this.facts.update((facts) => {
      const match = facts.find(
        (fact) => fact.topic.toLowerCase() === input.topic.toLowerCase() && fact.value.toLowerCase() === input.value.toLowerCase(),
      );
      if (match) {
        saved = {
          ...match,
          source: match.source === "said" || input.source === "said" ? "said" : "noticed",
          confidence: Math.max(match.confidence, confidence),
          evidence: [...match.evidence, ...evidence],
          updated: now,
        };
        return facts.map((fact) => (fact.id === match.id ? saved! : fact));
      }
      saved = { id: randomUUID(), topic: input.topic, value: input.value, source: input.source, confidence, evidence, updated: now };
      return [...facts, saved];
    });
    return saved!;
  }

  async forget(id: string): Promise<boolean> {
    let removed = false;
    await this.facts.update((facts) => {
      removed = facts.some((fact) => fact.id === id);
      return facts.filter((fact) => fact.id !== id);
    });
    return removed;
  }

  async noteOutcome(name: string, kept: boolean): Promise<Habit> {
    const now = new Date().toISOString();
    let saved: Habit | undefined;
    await this.habitsFile.update((habits) => {
      const current = habits.find((habit) => habit.name === name);
      const decay = current ? this.decay(current.updated) : 1;
      saved = {
        name,
        kept: (current?.kept ?? 0) * decay + (kept ? 1 : 0),
        rejected: (current?.rejected ?? 0) * decay + (kept ? 0 : 1),
        updated: now,
      };
      return current ? habits.map((habit) => (habit.name === name ? saved! : habit)) : [...habits, saved];
    });
    return saved!;
  }

  async habitStrengths(): Promise<HabitStrength[]> {
    const habits = await this.habitsFile.read();
    return habits
      .map((habit) => {
        const decay = this.decay(habit.updated);
        const kept = habit.kept * decay;
        const rejected = habit.rejected * decay;
        // Beta(1, 1) prior: with zero outcomes the preference is neutral (0.5).
        return { name: habit.name, preference: (kept + 1) / (kept + rejected + 2), outcomes: kept + rejected };
      })
      .sort((a, b) => b.outcomes - a.outcomes);
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
