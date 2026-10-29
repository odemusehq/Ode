import { z } from "zod";

export type Accent = "uk" | "us";

/** How Ode applies changes, like Claude Code's permission modes. */
export enum Mode {
  /** Ode changes what it is sure about and asks when it can't tell what the musician wants. */
  Auto = "auto",
  /** Ode asks before every change to the Set. */
  Manual = "manual",
}

export interface VocalRange {
  /** MIDI note numbers. */
  low: number;
  high: number;
}

export interface LoudnessTarget {
  lufs: number;
  truePeak: number;
}

export type Detectable<T> =
  | { mode: "detect"; detected?: { value: T; confidence: number } }
  | { mode: "set"; value: T };

export interface Personalisation {
  genre: Detectable<string>;
  spelling: Detectable<Accent>;
  pronunciation: Detectable<Accent>;
  vocalRange: Detectable<VocalRange>;
  loudnessTarget: Detectable<LoudnessTarget>;
}

export interface ResolvedPersonalisation {
  genre: string | null;
  spelling: Accent;
  pronunciation: Accent;
  vocalRange: VocalRange | null;
  loudnessTarget: LoudnessTarget;
}

export interface PreferencesFile {
  personalisation: Personalisation;
  mode: Mode;
}

export const STREAMING_TARGET: LoudnessTarget = { lufs: -14, truePeak: -1 };

/** About an octave and a half where most voices overlap (the A below middle C to the D above the next C), for when the artist's range is unknown. */
export const TYPICAL_VOCAL_RANGE: VocalRange = { low: 57, high: 74 };

export const DEFAULT_PERSONALISATION: Personalisation = {
  genre: { mode: "detect" },
  spelling: { mode: "detect" },
  pronunciation: { mode: "detect" },
  vocalRange: { mode: "detect" },
  loudnessTarget: { mode: "detect" },
};

export const DEFAULT_PREFERENCES: PreferencesFile = {
  personalisation: DEFAULT_PERSONALISATION,
  mode: Mode.Auto,
};

export function resolveDetectable<T>(value: Detectable<T> | undefined, fallback: T): T {
  if (!value) return fallback;
  if (value.mode === "set") return value.value;
  return value.detected ? value.detected.value : fallback;
}

function detectableSchema<T extends z.ZodType>(inner: T) {
  return z.union([
    z.object({
      mode: z.literal("detect"),
      detected: z.object({ value: inner, confidence: z.number() }).optional(),
    }),
    z.object({ mode: z.literal("set"), value: inner }),
  ]);
}

const accentSchema = z.enum(["uk", "us"]);
const vocalRangeSchema = z.object({ low: z.number(), high: z.number() });
const loudnessSchema = z.object({ lufs: z.number(), truePeak: z.number() });

export const PersonalisationSchema = z.object({
  genre: detectableSchema(z.string()),
  spelling: detectableSchema(accentSchema),
  pronunciation: detectableSchema(accentSchema),
  vocalRange: detectableSchema(vocalRangeSchema),
  loudnessTarget: detectableSchema(loudnessSchema),
});

/** Song-level overrides: any subset of the artist-level settings. */
export const PersonalisationOverridesSchema = PersonalisationSchema.partial();
export type PersonalisationOverrides = z.infer<typeof PersonalisationOverridesSchema>;

export const PreferencesFileSchema = z.object({
  personalisation: PersonalisationSchema,
  mode: z.enum(Mode).default(Mode.Auto),
});
