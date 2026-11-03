import { t } from "./i18n";
import { z } from "zod";
import { diffIndices } from "node-diff3";
import { ClipRefSchema, NoteSchema } from "./live-schemas";
import type { LyricsCheck, LineCheck } from "./lyrics";

export const WordCheckSchema = z.object({
  text: z.string(), syllables: z.array(z.string()), stress: z.array(z.number().int().min(0).max(2).nullable()),
  wordStress: z.array(z.number().int().min(0).max(2)).optional(),
  ipa: z.array(z.string()).optional(),
}).refine(word => word.syllables.length === word.stress.length, t("lyrics.document.stressAlignment"))
  .refine(word => !word.wordStress || word.wordStress.length === word.syllables.length, t("lyrics.document.stressAlignment"))
  .refine(word => !word.ipa?.length || word.ipa.length === word.syllables.length, t("lyrics.document.ipaAlignment"));
export const LineCheckSchema = z.object({
  words: z.array(WordCheckSchema),
  review: z.array(z.string()).optional(),
  rhyme: z.object({ letter: z.string(), quality: z.enum(["perfect", "near", "none"]), part: z.string(), sound: z.string() }),
});
export const LyricsCheckSchema = z.object({ lines: z.array(LineCheckSchema) });
const anchor = { line: z.number().int().positive(), text: z.string(), stale: z.boolean().optional() };
// A deliberate choice keeps both the literal line anchor and the literal word; neither is guessed from a new text.
export const WordChoiceSchema = z.object({
  line: z.number().int().positive(), lineText: z.string(), word: z.number().int().min(0), value: WordCheckSchema,
  default: WordCheckSchema.optional(),
  pronunciation: z.boolean().optional(),
  emphasis: z.boolean().optional(),
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
  analysis: z.object({ text: z.string(), accent: z.enum(["uk", "us"]), check: LyricsCheckSchema, choices: z.array(WordChoiceSchema).optional(), revision: z.number().int().nonnegative().optional() }).optional(),
  choices: z.array(WordChoiceSchema).default([]),
  clips: z.array(VocalClipSchema).default([]),
});
export type LyricsNotation = z.infer<typeof LyricsNotationSchema>;
export type WordChoice = z.infer<typeof WordChoiceSchema>;
export type VocalClip = z.infer<typeof VocalClipSchema>;
export const LyricsChoiceSchema = z.object({
  songId: z.string().min(1), baseRevision: z.number().int().min(0), notationRevision: z.number().int().min(0),
  line: z.number().int().positive(), word: z.number().int().min(0), value: WordCheckSchema,
  pronunciation: z.boolean().optional().describe("False for a sentence-emphasis-only edit; preserve the current automatic division and lexical wordStress. True or omitted for an explicit pronunciation override."),
  emphasis: z.boolean().optional().describe("False for a pronunciation-only edit: retain existing phrase emphasis, or leave it unknown after a changed division. True or omitted edits emphasis too."),
});
export type LyricsChoiceWrite = z.infer<typeof LyricsChoiceSchema>;

/** Literal emphasis patches in one lyric line, independent of pronunciation and MIDI. */
export const LyricsEmphasisSchema = z.object({
  songId: z.string().min(1), baseRevision: z.number().int().nonnegative(), notationRevision: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  changes: z.array(z.object({ word: z.number().int().nonnegative(), text: z.string().min(1), syllables: z.array(z.string().min(1)).min(1),
    syllable: z.number().int().nonnegative(), value: z.number().int().min(0).max(2) })).min(1),
}).refine(input => new Set(input.changes.map(change => `${change.word}/${change.syllable}`)).size === input.changes.length, t("lyrics.document.annotationsChanged"));
export type LyricsEmphasisWrite = z.infer<typeof LyricsEmphasisSchema>;

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
      || notation.analysis.revision !== notation.revision
      || notation.analysis.check.lines.some(line => line.review === undefined)
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
      if (!complete || analysis.revision !== notation.revision) delete check.review;
      for (const choice of notation.choices) {
        if (!choice.stale && choice.line === index + 1 && choice.lineText === line && check.words[choice.word]?.text === choice.value.text) {
          const automatic = check.words[choice.word]!;
          if (choice.pronunciation === false) {
            if (choice.emphasis !== false && JSON.stringify(choice.value.syllables) === JSON.stringify(automatic.syllables)) check.words[choice.word] = { ...automatic, stress: choice.value.stress.map((value, at) => value ?? automatic.stress[at] ?? null) };
            continue;
          }
          check.words[choice.word] = structuredClone({ ...choice.value,
            ...(!choice.value.wordStress && JSON.stringify(choice.value.syllables) === JSON.stringify(automatic.syllables) && automatic.wordStress ? { wordStress: automatic.wordStress } : {}) });
          const baseline = JSON.stringify(choice.value.syllables) === JSON.stringify(automatic.syllables) ? automatic.stress : choice.value.syllables.map(() => null);
          check.words[choice.word]!.stress = choice.emphasis === false ? [...baseline] : choice.value.stress.map((value, at) => value ?? baseline[at] ?? null);
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
