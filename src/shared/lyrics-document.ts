import { t } from "./i18n";
import { z } from "zod";
import { diffIndices } from "node-diff3";
import { ClipRefSchema, NoteSchema } from "./live-schemas";
import type { LyricsCheck, LineCheck } from "./lyrics";

export const WordCheckSchema = z.object({
  text: z.string(), syllables: z.array(z.string()), stress: z.array(z.number().int().min(0).max(2)),
  ipa: z.array(z.string()).optional(),
}).refine(word => word.syllables.length === word.stress.length, t("lyrics.document.stressAlignment"))
  .refine(word => !word.ipa?.length || word.ipa.length === word.syllables.length, t("lyrics.document.ipaAlignment"));
export const LineCheckSchema = z.object({
  words: z.array(WordCheckSchema),
  rhyme: z.object({ letter: z.string(), quality: z.enum(["perfect", "near", "none"]), part: z.string(), sound: z.string() }),
});
export const LyricsCheckSchema = z.object({ lines: z.array(LineCheckSchema) });
const anchor = { line: z.number().int().positive(), text: z.string(), stale: z.boolean().optional() };
// A deliberate choice keeps both the literal line anchor and the literal word; neither is guessed from a new text.
export const WordChoiceSchema = z.object({
  line: z.number().int().positive(), lineText: z.string(), word: z.number().int().min(0), value: WordCheckSchema,
  stale: z.boolean().optional(),
});
export const SyllableBindingSchema = z.object({ ...anchor, word: z.number().int().min(0), syllable: z.number().int().min(0), notes: z.array(z.number().int().min(0)).min(1) });
/** MusicXML's beats/beat-type and measure cursor, in quarter-note divisions. */
export const ScoreMeterSchema = z.object({ beats: z.string().trim().regex(/^[1-9]\d*(?:\s*\+\s*[1-9]\d*)*$/), beatType: z.number().int().positive() });
export const ScoreMeasureSchema = z.object({ number: z.string().min(1), start: z.number().nonnegative(), length: z.number().positive(), meter: ScoreMeterSchema.optional(), implicit: z.boolean().optional() });
export type ScoreMeter = z.infer<typeof ScoreMeterSchema>;
export type ScoreMeasure = z.infer<typeof ScoreMeasureSchema>;
export const VocalClipSchema = z.object({ id: z.string().min(1), clip: ClipRefSchema, notes: z.array(NoteSchema), bindings: z.array(SyllableBindingSchema), measures: z.array(ScoreMeasureSchema).min(1).optional() });
export const LyricsNotationSchema = z.object({
  revision: z.number().int().min(0).default(0),
  analysis: z.object({ text: z.string(), accent: z.enum(["uk", "us"]), check: LyricsCheckSchema, choices: z.array(WordChoiceSchema).optional() }).optional(),
  choices: z.array(WordChoiceSchema).default([]),
  clips: z.array(VocalClipSchema).default([]),
});
export type LyricsNotation = z.infer<typeof LyricsNotationSchema>;
export type WordChoice = z.infer<typeof WordChoiceSchema>;
export type VocalClip = z.infer<typeof VocalClipSchema>;
export const LyricsChoiceSchema = z.object({
  songId: z.string().min(1), baseRevision: z.number().int().min(0), notationRevision: z.number().int().min(0),
  line: z.number().int().positive(), word: z.number().int().min(0), value: WordCheckSchema,
});
export type LyricsChoiceWrite = z.infer<typeof LyricsChoiceSchema>;

/** A direct musician edit of an existing linked native note; all coordinates are quarter-note beats. */
export const LyricsMelodyEditSchema = z.object({
  songId: z.string().min(1), baseRevision: z.number().int().nonnegative(), notationRevision: z.number().int().nonnegative(),
  clipId: z.string().min(1), note: z.number().int().nonnegative(),
  pitch: z.number().int().min(0).max(127).optional(), duration: z.number().positive().optional(), start: z.number().nonnegative().optional(),
}).refine(edit => edit.pitch !== undefined || edit.duration !== undefined || edit.start !== undefined, t("lyrics.document.noteEditRequired"));
export type LyricsMelodyEdit = z.infer<typeof LyricsMelodyEditSchema>;

const UNMARKED: LineCheck = { words: [], rhyme: { letter: "", quality: "none", part: "", sound: "" } };
const sung = (line: string) => line.trim().length > 0 && !/^\s*\[[^\]]*\]\s*$/.test(line);

/** Draft words, model annotations and deliberate choices; actual note values come from Live. */
export class LyricsDocument {
  static empty(): LyricsNotation { return { revision: 0, choices: [], clips: [] }; }

  /** MusicXML denominator units, not an inferred accent pattern or a lyric syllable counter. */
  static measureLength(meter: ScoreMeter): number { return meter.beats.split("+").reduce((sum, part) => sum + Number(part.trim()), 0) * 4 / meter.beatType; }

  /** Uses the measure layout read from the score. A short first implicit measure is a pickup. */
  static position(clip: VocalClip, start: number): { measure: string; beat: number; meter: ScoreMeter } | undefined {
    const index = clip.measures?.findIndex(measure => start >= measure.start && start < measure.start + measure.length) ?? -1;
    const measure = clip.measures?.[index];
    if (!measure?.meter) return undefined;
    const pickup = index === 0 && measure.implicit ? Math.max(0, LyricsDocument.measureLength(measure.meter) - measure.length) : 0;
    return { measure: measure.number, beat: 1 + (start - measure.start + pickup) * measure.meter.beatType / 4, meter: measure.meter };
  }

  static needsAnalysis(notation: LyricsNotation | undefined, text: string): boolean {
    return !notation?.analysis || JSON.stringify(notation.analysis.text.split("\n").filter(sung).map(line => line.trim())) !== JSON.stringify(text.split("\n").filter(sung).map(line => line.trim()))
      || JSON.stringify(notation.analysis.choices ?? []) !== JSON.stringify(notation.choices);
  }

  /** The same effective analysis for the musician and Ode. Old rhyme groups never cross a text edit. */
  static check(notation: LyricsNotation, text: string): LyricsCheck | undefined {
    const analysis = notation.analysis;
    if (!analysis) return undefined;
    const raw = text.split("\n");
    const old = analysis.text.split("\n");
    const unchanged = LyricsDocument.lineMap(analysis.text, text);
    const from = new Map<number, LineCheck>();
    let at = 0;
    old.forEach((line, index) => {
      if (!sung(line)) return;
      const check = analysis.check.lines[at++];
      const moved = unchanged.get(index + 1);
      if (check && moved !== undefined) from.set(moved, check);
    });
    const complete = JSON.stringify(raw.filter(sung).map(line => line.trim())) === JSON.stringify(old.filter(sung).map(line => line.trim()))
      && JSON.stringify(analysis.choices ?? []) === JSON.stringify(notation.choices);
    return { lines: raw.flatMap((line, index) => {
      if (!sung(line)) return [];
      const found = from.get(index + 1);
      const check = structuredClone(found ?? UNMARKED);
      if (!complete) check.rhyme = { ...UNMARKED.rhyme };
      for (const choice of notation.choices) {
        if (!choice.stale && choice.line === index + 1 && choice.lineText === line && check.words[choice.word]?.text === choice.value.text) {
          check.words[choice.word] = structuredClone(choice.value);
        }
      }
      return [check];
    }) };
  }

  /** Relocate only unchanged literal lines. Changed words keep their music, explicitly awaiting reconciliation. */
  static reconcile(notation: LyricsNotation, before: string, after: string): LyricsNotation {
    if (before === after) return notation;
    const next = structuredClone(notation);
    const moved = LyricsDocument.lineMap(before, after);
    for (const clip of next.clips) for (const binding of clip.bindings) {
      const line = moved.get(binding.line);
      if (!binding.stale && line !== undefined && after.split("\n")[line - 1] === binding.text) binding.line = line;
      else binding.stale = true;
    }
    for (const choice of next.choices) {
      const line = moved.get(choice.line);
      if (!choice.stale && line !== undefined && after.split("\n")[line - 1] === choice.lineText) choice.line = line;
      else choice.stale = true;
    }
    next.revision++;
    return next;
  }

  /** Literal text diff only. It supplies no linguistic or musical interpretation. */
  private static lineMap(before: string, after: string): Map<number, number> {
    const a = before.split("\n"), b = after.split("\n");
    const map = new Map<number, number>();
    let old = 0, current = 0;
    for (const change of diffIndices(a, b)) {
      while (old < change.buffer1[0]) map.set(++old, ++current);
      old = change.buffer1[0] + change.buffer1[1];
      current = change.buffer2[0] + change.buffer2[1];
    }
    while (old < a.length && current < b.length) map.set(++old, ++current);
    return map;
  }
}
