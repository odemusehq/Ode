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

export const SectionSchema = z.object({
  id: z.string(),
  kind: z.enum(SECTION_KINDS),
  name: z.string(),
  /** Arrangement position in beats. */
  startBeat: z.number(),
  lengthBeats: z.number(),
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
  /**
   * The song's lyrics as one text that the musician and Ode both edit: one sung line per line, blank lines
   * between stanzas; a line in square brackets, such as "[Chorus]", is an unsung label.
   */
  lyrics: z.string().default(""),
  /** Goes up by one with every save of the lyrics, so edits made at the same time can be merged. */
  lyricsRevision: z.number().int().min(0).default(0),
  /** The song's form and chords; tempo, key and time signature are read from Live. */
  sections: z.array(SectionSchema).default([]),
  links: z.array(ClipLinkSchema).default([]),
  /** Things the musician asked Ode to keep exactly as they are (free text or tags). */
  locked: z.array(z.string()).default([]),
  /** The names of the lyrics' sections that ask for perfect rhymes, set in the Lyrics editor. */
  strictRhymes: z.array(z.string()).default([]),
  credits: z.array(CreditSchema).default([]),
  notes: z.array(z.string()).default([]),
});
export type LeadSheet = z.infer<typeof LeadSheetSchema>;

export function emptyLeadSheet(): LeadSheet {
  return LeadSheetSchema.parse({});
}
