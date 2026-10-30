import { createHash } from "node:crypto";
import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import type { ChordEvent, RetainedHook } from "../../shared/song";
import type { PitchRange } from "../harmony/pitch-range";
import { LyricSetter } from "../prosody/lyric-setter";
import { Meter } from "../prosody/meter";
import { melodyLine } from "../prosody/melody-line";
import type { PlannedSyllable } from "../prosody/option-chooser";
import { DEFAULT_SEED, type MelodyPlan } from "./melody-plan";
import { writeMelody } from "./melody-writer";

export interface MelodyPhrase {
  /** 1-based index in the supplied lyric lines. */
  line: number;
  startBeat: number;
  lengthBeats: number;
  motifId?: string;
  hookId?: string;
}

export interface WrittenPhrase extends MelodyPhrase {
  text: string;
  notes: Note[];
  syllables: PlannedSyllable[];
  /** Note indices address the combined returned notes, not a discarded draft. */
  alignment: { syllable: number; note: number }[];
  splitSyllables: number[];
  melismaSyllables: number[];
  uncertainWords: string[];
}

/** Stable content evidence; sorting and explicit fields avoid depending on object property order. */
export function melodyNoteHash(notes: readonly Note[]): string {
  const canonical = notes.map(({ pitch, start, duration, velocity, muted, probability, velocityDeviation, releaseVelocity }) =>
    ({ pitch, start, duration, velocity, muted, probability, velocityDeviation, releaseVelocity }))
    .map((note) => JSON.stringify(note)).sort();
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Retain a source phrase whole, with nonnegative hook-local coordinates and every performance field intact. */
export function hookNotesInRange(notes: readonly Note[], startBeat: number, lengthBeats: number): Note[] {
  if (!Number.isFinite(startBeat) || startBeat < 0 || !Number.isFinite(lengthBeats) || lengthBeats <= 0) throw new Error("A hook source needs a nonnegative start and a finite positive length.");
  const end = startBeat + lengthBeats;
  const overlapping = notes.filter((note) => note.start < end && note.start + note.duration > startBeat);
  if (overlapping.some((note) => note.start < startBeat - 1e-6 || note.start + note.duration > end + 1e-6)) {
    throw new Error("The retained hook boundary crosses a held note. Choose a complete phrase or revise its notes explicitly.");
  }
  return overlapping.map((note) => ({ ...note, start: Math.max(0, note.start - startBeat) }));
}

/** Chords overlapping one phrase, clipped and moved to its local coordinates. */
function phraseChords(chords: ChordEvent[], start: number, length: number): ChordEvent[] {
  return chords.filter((chord) => chord.beat < start + length && chord.beat + chord.lengthBeats > start).map((chord) => {
    const from = Math.max(start, chord.beat);
    return { ...chord, beat: from - start, lengthBeats: Math.min(start + length, chord.beat + chord.lengthBeats) - from };
  });
}

/** Reject ambiguous boundaries instead of silently assigning a sung line or a held note to another phrase. */
export function validateMelodyPhrases(phrases: MelodyPhrase[], lineCount: number, lengthBeats: number): void {
  if (phrases.length === 0) throw new Error("Give at least one lyric phrase.");
  const ordered = [...phrases].sort((a, b) => a.startBeat - b.startBeat);
  for (const [index, phrase] of ordered.entries()) {
    if (!Number.isInteger(phrase.line) || phrase.line < 1 || phrase.line > lineCount) throw new Error("Each phrase line must address a supplied lyric line (from 1).");
    if (!Number.isFinite(phrase.startBeat) || phrase.startBeat < 0 || !Number.isFinite(phrase.lengthBeats) || phrase.lengthBeats <= 0 ||
      phrase.startBeat + phrase.lengthBeats > lengthBeats + 1e-6) throw new Error("Every phrase must fit the clip's nonnegative beat coordinates.");
    const previous = ordered[index - 1];
    if (previous && previous.startBeat + previous.lengthBeats > phrase.startBeat + 1e-6) throw new Error("Lyric phrase spans overlap. Choose nonoverlapping sung spans, or write the intended overlapping notes directly.");
  }
  for (let line = 1; line <= lineCount; line++) if (!phrases.some((phrase) => phrase.line === line)) throw new Error(`Lyric line ${line} has no phrase; give its span or leave it out of this call.`);
}

/**
 * Drafts phrases from one brief. A named motif reuses the first chosen shape with proportional timing; a retained
 * hook keeps exact pitch, rhythm and performance fields. Different lyrics may need an explicit hook revision.
 */
export function writeLyricPhrases(plan: MelodyPlan, chords: ChordEvent[], range: PitchRange,
  lines: { text: string; analysis: LineAnalysis }[], phrases: MelodyPhrase[], hooks: RetainedHook[] = []): { notes: Note[]; phrases: WrittenPhrase[] } {
  const meter = new Meter(plan.signature.numerator, plan.signature.denominator);
  const length = plan.lengthBeats ?? plan.bars * meter.barLength;
  validateMelodyPhrases(phrases, lines.length, length);
  if (new Set(hooks.map((hook) => hook.id)).size !== hooks.length) throw new Error("Retained hook IDs must be unique.");
  const retained = new Map(hooks.map((hook) => [hook.id, hook]));
  const motifs = new Map<string, { notes: Note[]; lengthBeats: number }>();
  const notes: Note[] = [];
  const written: WrittenPhrase[] = [];
  for (const [index, phrase] of [...phrases].sort((a, b) => a.startBeat - b.startBeat).entries()) {
    const line = lines[phrase.line - 1]!;
    const motifId = phrase.motifId ?? (plan.motifBars !== undefined ? "shared" : undefined);
    const hook = phrase.hookId ? retained.get(phrase.hookId) : undefined;
    if (phrase.hookId && !hook?.notes) throw new Error(`Retained hook ${phrase.hookId} needs its current, verified notes.`);
    let local: Note[];
    if (hook) {
      if (hook.lengthBeats > phrase.lengthBeats + 1e-6) throw new Error(`Hook ${hook.id} does not fit this phrase. Revise it explicitly rather than clipping its notes.`);
      if (plan.motifBars !== undefined && Math.abs(plan.motifBars * meter.barLength - hook.lengthBeats) > 1e-6) throw new Error("motifBars conflicts with the retained hook's length. Choose the intended phrase explicitly.");
      local = hook.notes!.map((note) => ({ ...note }));
      if (motifId) {
        const previous = motifs.get(motifId);
        if (previous && melodyNoteHash(previous.notes) !== melodyNoteHash(local)) throw new Error(`Motif ${motifId} has two different chosen hooks. Give them different motif IDs or revise the shared choice.`);
        motifs.set(motifId, { notes: local, lengthBeats: hook.lengthBeats });
      }
    } else {
      let motif = motifId ? motifs.get(motifId) : undefined;
      if (!motif) {
        const motifLength = plan.motifBars === undefined ? phrase.lengthBeats : plan.motifBars * meter.barLength;
        if (motifLength > phrase.lengthBeats + 1e-6) throw new Error("motifBars is longer than the lyric phrase. Choose a shorter motif or a longer phrase explicitly.");
        const drafted = writeMelody({ ...plan, bars: motifLength / meter.barLength, lengthBeats: motifLength,
          beatOffset: (plan.beatOffset ?? 0) + phrase.startBeat, seed: (plan.seed ?? DEFAULT_SEED) + index },
        phraseChords(chords, phrase.startBeat, motifLength), range, line.analysis);
        motif = { notes: drafted, lengthBeats: motifLength };
        if (motifId) motifs.set(motifId, motif);
      }
      if (plan.motifBars !== undefined) {
        // An explicit motif length repeats as written; a partial final statement is refused rather than cropped.
        const repetitions = phrase.lengthBeats / motif.lengthBeats;
        if (Math.abs(repetitions - Math.round(repetitions)) > 1e-6) throw new Error("The requested motifBars does not fill this phrase in whole statements. Use explicit phrase motifs or revise its length.");
        local = Array.from({ length: Math.round(repetitions) }, (_, repeat) => motif!.notes.map((note) =>
          ({ ...note, start: note.start + repeat * motif!.lengthBeats }))).flat();
      } else {
        const scale = phrase.lengthBeats / motif.lengthBeats;
        local = motif.notes.map((note) => ({ ...note, start: note.start * scale, duration: note.duration * scale }));
      }
    }
    if (local.some((note) => !note.muted && (note.pitch < range.low || note.pitch > range.high))) throw new Error("The retained hook exceeds the requested singer range. Revise the hook or range explicitly.");
    const positioned = local.map((note) => ({ ...note, start: note.start + phrase.startBeat }));
    const setting = new LyricSetter(new Meter(plan.signature.numerator, plan.signature.denominator, plan.beatOffset ?? 0)).set(line.analysis, positioned);
    if (hook && setting.splitSyllables.length > 0) throw new Error(`The lyrics need to split notes in retained hook ${hook.id}. Revise the words or hook explicitly.`);
    if (setting.alignment.length === 0) throw new Error(`Lyric line ${phrase.line} has no audible melody notes to align.`);
    if (hook && melodyNoteHash(setting.notes) !== melodyNoteHash(melodyLine(positioned))) throw new Error(`The lyric setting would change retained hook ${hook.id}. Revise it explicitly.`);
    // Analysis uses the sung top line; a retained polyphonic/muted performance remains whole in the editable output.
    const kept = hook ? positioned : setting.notes;
    const alignment = hook ? setting.alignment.map((pair) => ({ ...pair,
      note: kept.findIndex((note) => melodyNoteHash([note]) === melodyNoteHash([setting.notes[pair.note]!])) })) : setting.alignment;
    const firstNote = notes.length;
    notes.push(...kept);
    written.push({ ...phrase, ...(motifId ? { motifId } : {}), text: line.text, notes: kept, syllables: setting.syllables,
      alignment: alignment.map((pair) => ({ ...pair, note: firstNote + pair.note })),
      splitSyllables: setting.splitSyllables, melismaSyllables: setting.melismaSyllables,
      uncertainWords: line.analysis.words.filter((word) => !word.certain).map((word) => word.text) });
  }
  return { notes, phrases: written };
}
