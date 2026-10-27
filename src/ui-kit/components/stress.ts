import type { SyllableInfo } from "../../shared/lyrics";

export type Stress = SyllableInfo["stress"];

/** Scansion marks: acute for primary stress, grave for secondary, breve for unstressed. */
export const STRESS_MARKS: Record<Stress, string> = { 0: "˘", 1: "ˊ", 2: "ˋ" };

export const STRESS_NAMES: Record<Stress, string> = { 0: "unstressed", 1: "stressed", 2: "secondary stress" };
