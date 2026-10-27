import { z } from "zod";
import { PersonalisationOverridesSchema } from "./personalisation";

export const SECTION_KINDS = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
  "breakdown",
  "build",
  "drop",
  "outro",
  "other",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const ChordEventSchema = z.object({
  /** Beat from the start of the section. */
  beat: z.number(),
  lengthBeats: z.number(),
  /** Chord symbol, e.g. "Am7", "F/C", "Bb". */
  symbol: z.string(),
});
export type ChordEvent = z.infer<typeof ChordEventSchema>;

export const LyricLineSchema = z.object({
  id: z.string(),
  text: z.string(),
  locked: z.boolean().optional(),
});
export type LyricLine = z.infer<typeof LyricLineSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  kind: z.enum(SECTION_KINDS),
  name: z.string(),
  /** Arrangement position in beats. */
  startBeat: z.number(),
  lengthBeats: z.number(),
  lines: z.array(LyricLineSchema).default([]),
  chords: z.array(ChordEventSchema).default([]),
});
export type Section = z.infer<typeof SectionSchema>;

export const ClipLinkSchema = z.object({
  /** Tag at the end of the clip or track name, without the separator. */
  tag: z.string(),
  role: z.string(),
  description: z.string(),
});
export type ClipLink = z.infer<typeof ClipLinkSchema>;

export const IntentSchema = z
  .object({
    theme: z.string(),
    story: z.string(),
    pointOfView: z.string(),
    mood: z.string(),
    hook: z.string(),
  })
  .partial();
export type Intent = z.infer<typeof IntentSchema>;

export const CreditSchema = z.object({ role: z.string(), name: z.string() });
export type Credit = z.infer<typeof CreditSchema>;

export const LeadSheetSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().default(""),
  intent: IntentSchema.default({}),
  settings: PersonalisationOverridesSchema.default({}),
  tempo: z.number().optional(),
  key: z.object({ root: z.number(), scale: z.string() }).optional(),
  timeSignature: z.object({ numerator: z.number(), denominator: z.number() }).optional(),
  sections: z.array(SectionSchema).default([]),
  links: z.array(ClipLinkSchema).default([]),
  /** Things the musician asked Ode never to change (free text or tags). */
  locked: z.array(z.string()).default([]),
  credits: z.array(CreditSchema).default([]),
  notes: z.array(z.string()).default([]),
});
export type LeadSheet = z.infer<typeof LeadSheetSchema>;

export const HISTORY_KINDS = ["suggested", "kept", "changed", "rejected"] as const;

export const HistoryEntrySchema = z.object({
  time: z.string(),
  kind: z.enum(HISTORY_KINDS),
  what: z.string(),
  detail: z.unknown().optional(),
  reason: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export function emptyLeadSheet(): LeadSheet {
  return LeadSheetSchema.parse({});
}
