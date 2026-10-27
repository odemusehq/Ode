import { DrumNote } from "./drum-kit";

/** One bar of a drum part on a sixteenth-note grid: "X" accent, "x" normal hit, "o" ghost note, "." rest. */
export type StepPattern = Partial<Record<DrumNote, string>>;

export enum HitStrength {
  Accent = "X",
  Normal = "x",
  Ghost = "o",
}

export interface StepHit {
  drum: DrumNote;
  step: number;
  strength: HitStrength;
}

export const STEPS_PER_BAR = 16;
/** A sixteenth note in quarter-note beats. */
export const STEP_BEATS = 0.25;

const STRENGTHS: ReadonlyMap<string, HitStrength> = new Map([
  [HitStrength.Accent, HitStrength.Accent],
  [HitStrength.Normal, HitStrength.Normal],
  [HitStrength.Ghost, HitStrength.Ghost],
]);

export function hitsOf(pattern: StepPattern): StepHit[] {
  const hits: StepHit[] = [];
  for (const [key, steps] of Object.entries(pattern) as [string, string | undefined][]) {
    if (!steps) continue;
    const drum = Number(key) as DrumNote;
    [...steps].slice(0, STEPS_PER_BAR).forEach((symbol, step) => {
      const strength = STRENGTHS.get(symbol);
      if (strength) hits.push({ drum, step, strength });
    });
  }
  return hits;
}

/** Combines patterns; later patterns add hits (and replace a drum's hit on the same step). */
export function layer(...patterns: StepPattern[]): StepHit[] {
  const byKey = new Map<string, StepHit>();
  for (const pattern of patterns) {
    for (const hit of hitsOf(pattern)) byKey.set(`${hit.drum}:${hit.step}`, hit);
  }
  return [...byKey.values()];
}
