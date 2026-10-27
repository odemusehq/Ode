import type { z } from "zod";
import {
  DEFAULT_PREFERENCES,
  PreferencesFileSchema,
  STREAMING_TARGET,
  type Accent,
  type Detectable,
  type Personalisation,
  type PreferencesFile,
  type ResolvedPersonalisation,
} from "../shared/personalisation";
import type { PreferencesUpdate } from "../shared/api";
import type { LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { SpellingDetector } from "./spelling";

type DetectableValue<K extends keyof Personalisation> = Personalisation[K] extends Detectable<infer T> ? T : never;

/** Artist-level settings: Personalisation and the kinds of change allowed without asking. */
export class PreferencesStore {
  private readonly file: JsonFile<PreferencesFile>;
  private readonly spelling = new SpellingDetector();

  constructor(path: string) {
    this.file = new JsonFile(path, PreferencesFileSchema as z.ZodType<PreferencesFile>, () => structuredClone(DEFAULT_PREFERENCES));
  }

  get(): Promise<PreferencesFile> {
    return this.file.read();
  }

  update(update: PreferencesUpdate): Promise<PreferencesFile> {
    return this.file.update((current) => ({
      personalisation: { ...current.personalisation, ...update.personalisation },
      allowedChanges: update.allowedChanges ?? current.allowedChanges,
    }));
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

  async allow(toolName: string): Promise<void> {
    await this.file.update((current) =>
      current.allowedChanges.includes(toolName) ? current : { ...current, allowedChanges: [...current.allowedChanges, toolName] },
    );
  }

  async isAllowed(toolName: string): Promise<boolean> {
    return (await this.file.read()).allowedChanges.includes(toolName);
  }

  /** The settings in force for a song: song overrides, then artist settings, then detection. */
  async effective(sheet: LeadSheet): Promise<ResolvedPersonalisation> {
    const artist = (await this.file.read()).personalisation;
    const merged: Personalisation = { ...artist, ...sheet.settings } as Personalisation;
    const lyrics = sheet.sections.flatMap((section) => section.lines.map((line) => line.text));
    const spelling = this.resolveAccent(merged.spelling, lyrics);
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
