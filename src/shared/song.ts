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

/** Retained notes keep their performance fields; this is ordinary editable MIDI, not an audio promise. */
const HookNoteSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  start: z.number().min(0),
  duration: z.number().positive(),
  velocity: z.number().min(1).max(127).optional(),
  muted: z.boolean().optional(),
  probability: z.number().min(0).max(1).optional(),
  velocityDeviation: z.number().min(-127).max(127).optional(),
  releaseVelocity: z.number().min(0).max(127).optional(),
});

export const RetainedHookSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  lengthBeats: z.number().positive(),
  /** Notes start at the beginning of the retained phrase, including any initial rest. */
  notes: z.array(HookNoteSchema).min(1).optional(),
  /** A source is evidence to recheck, not a durable Live object identity. */
  source: z.object({ tag: z.string().min(1), startBeat: z.number().min(0).optional(), noteHash: z.string().regex(/^[a-f0-9]{64}$/i) }).optional(),
}).refine((hook) => hook.notes !== undefined || hook.source !== undefined, "A hook needs retained notes or a source tag and note hash.")
  .refine((hook) => (hook.notes ?? []).every((note) => note.start + note.duration <= hook.lengthBeats + 1e-6), "Hook notes must fit its lengthBeats.");
export type RetainedHook = z.infer<typeof RetainedHookSchema>;

export const CompositionSchema = z.object({
  hooks: z.array(RetainedHookSchema).default([]),
  phrases: z.array(z.object({
    id: z.string().min(1),
    sectionId: z.string().min(1),
    lyricsRevision: z.number().int().min(0),
    /** Absolute text line, including label and blank lines, as lyrics_read numbers it. */
    line: z.number().int().min(1),
    text: z.string().min(1),
    /** Section-relative quarter-note beats; a pickup may be negative if its Arrangement position is not. */
    startBeat: z.number(),
    lengthBeats: z.number().positive(),
    hookId: z.string().min(1).optional(),
    motifId: z.string().min(1).optional(),
  })).default([]),
  parts: z.array(z.object({
    sectionId: z.string().min(1),
    role: z.string().min(1),
    tag: z.string().min(1).optional(),
    /** Section-relative activity, including pickups and intentionally held endings. */
    activity: z.array(z.object({ startBeat: z.number(), lengthBeats: z.number().positive() })),
    constraints: z.array(z.string()).default([]),
  })).default([]),
  notes: z.array(z.string()).default([]),
});
export type Composition = z.infer<typeof CompositionSchema>;

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
  /** Musical decisions survive conversation truncation. Old songs need no composition field. */
  composition: CompositionSchema.optional(),
});
export type LeadSheet = z.infer<typeof LeadSheetSchema>;

export function emptyLeadSheet(): LeadSheet {
  return LeadSheetSchema.parse({});
}

/** Read-time findings leave stale musical decisions intact for deliberate reconciliation. */
export function compositionStatus(sheet: LeadSheet): { stale: boolean; issues: string[]; rechecked: string[]; sources: "unverified" | "none" } {
  const composition = sheet.composition;
  if (!composition) return { stale: false, issues: [], rechecked: [], sources: "none" };
  const issues: string[] = [];
  const rechecked: string[] = [];
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) issues.push(`${label} IDs must be unique.`);
  };
  unique(sheet.sections.map((section) => section.id), "Section");
  unique(composition.hooks.map((hook) => hook.id), "Hook");
  unique(composition.phrases.map((phrase) => phrase.id), "Phrase");
  const sections = new Map(sheet.sections.map((section) => [section.id, section]));
  const hooks = new Set(composition.hooks.map((hook) => hook.id));
  const lines = sheet.lyrics.split(/\r\n|\r|\n/);
  for (const phrase of composition.phrases) {
    const section = sections.get(phrase.sectionId);
    if (!section) issues.push(`${phrase.id}: section ${phrase.sectionId} is missing.`);
    else if (section.startBeat + phrase.startBeat < 0) issues.push(`${phrase.id}: its pickup starts before the Arrangement.`);
    if (lines[phrase.line - 1] !== phrase.text) {
      issues.push(`${phrase.id}: its lyric binding is stale; read the current lyrics and reconcile the phrase.`);
    } else if (phrase.lyricsRevision !== sheet.lyricsRevision) rechecked.push(phrase.id);
    if (/^\s*\[.*\]\s*$/.test(phrase.text) || !phrase.text.trim()) issues.push(`${phrase.id}: a lyric phrase must name a sung line.`);
    if (phrase.hookId && !hooks.has(phrase.hookId)) issues.push(`${phrase.id}: hook ${phrase.hookId} is missing.`);
  }
  for (const part of composition.parts) {
    const section = sections.get(part.sectionId);
    if (!section) issues.push(`${part.role}: section ${part.sectionId} is missing.`);
    else if (part.activity.some((span) => section.startBeat + span.startBeat < 0)) issues.push(`${part.role}: its activity starts before the Arrangement.`);
  }
  return { stale: issues.length > 0, issues, rechecked, sources: composition.hooks.some((hook) => hook.source) ? "unverified" : "none" };
}

/** Call only for a newly supplied plan; later human edits may make a stored plan stale without deleting it. */
export function validateComposition(composition: Composition, sheet: LeadSheet): void {
  const parsed = CompositionSchema.parse(composition);
  if (parsed.phrases.some((phrase) => phrase.lyricsRevision !== sheet.lyricsRevision)) throw new Error("A newly supplied composition must bind its phrases to the current lyrics revision.");
  const status = compositionStatus({ ...sheet, composition: parsed });
  if (status.stale) throw new Error(status.issues.join(" "));
}
