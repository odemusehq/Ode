import type { z } from "zod";
import {
  DEFAULT_PREFERENCES,
  PreferencesFileSchema,
  STREAMING_TARGET,
  type Accent,
  type Detectable,
  type Mode,
  type Personalisation,
  type PreferencesFile,
  type ResolvedPersonalisation,
} from "../shared/personalisation";
import type { LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { LyricsText } from "./lyrics-text";
import { SpellingDetector } from "./spelling";

export type DetectableValue<K extends keyof Personalisation> = Personalisation[K] extends Detectable<infer T> ? T : never;

/** Artist-level settings (genre, spelling, pronunciation, vocal range, loudness target) and the mode Ode works in. */
export class PreferencesStore {
  private readonly file: JsonFile<PreferencesFile>;
  private readonly spelling = new SpellingDetector();

  constructor(path: string) {
    this.file = new JsonFile(path, PreferencesFileSchema as z.ZodType<PreferencesFile>, () => structuredClone(DEFAULT_PREFERENCES));
  }

  get(): Promise<PreferencesFile> {
    return this.file.read();
  }

  /** How Ode applies changes: Auto (the default), Manual or Let me hear it. */
  async mode(): Promise<Mode> {
    return (await this.file.read()).mode;
  }

  async setMode(mode: Mode): Promise<Mode> {
    return (await this.file.update((current) => ({ ...current, mode }))).mode;
  }

  /** Stores what the musician said about themselves as their own setting, for every song; it replaces anything detected. */
  setByMusician<K extends keyof Personalisation>(key: K, value: DetectableValue<K>): Promise<PreferencesFile> {
    return this.file.update((current) => {
      const setting = { mode: "set", value } as Personalisation[K];
      return { ...current, personalisation: { ...current.personalisation, [key]: setting } };
    });
  }

  /** Stores a detected value; ignored when the musician has set the value themselves. */
  recordDetected<K extends keyof Personalisation>(key: K, value: DetectableValue<K>, confidence: number): Promise<PreferencesFile> {
    return this.file.update((current) => {
      const setting = current.personalisation[key];
      if (setting.mode === "set") return current;
      const detected = { mode: "detect", detected: { value, confidence } } as Personalisation[K];
      return { ...current, personalisation: { ...current.personalisation, [key]: detected } };
    });
  }

  /** The settings in force for a song: song overrides, then artist settings, then detection. */
  async effective(sheet: LeadSheet): Promise<ResolvedPersonalisation> {
    const artist = (await this.file.read()).personalisation;
    const merged: Personalisation = { ...artist, ...sheet.settings } as Personalisation;
    const spelling = this.resolveAccent(merged.spelling, LyricsText.sung(sheet.lyrics));
    return {
      genre: this.resolveOptional(merged.genre),
      spelling,
      pronunciation: merged.pronunciation.mode === "set" ? merged.pronunciation.value : merged.pronunciation.detected?.value ?? spelling,
      vocalRange: this.resolveOptional(merged.vocalRange),
      loudnessTarget: this.resolveOptional(merged.loudnessTarget) ?? STREAMING_TARGET,
    };
  }

  private resolveAccent(setting: Detectable<Accent>, lyrics: readonly string[]): Accent {
    if (setting.mode === "set") return setting.value;
    if (setting.detected) return setting.detected.value;
    return this.spelling.detect(lyrics)?.value ?? this.spelling.fromLocale() ?? "us";
  }

  private resolveOptional<T>(setting: Detectable<T>): T | null {
    if (setting.mode === "set") return setting.value;
    return setting.detected?.value ?? null;
  }
}
