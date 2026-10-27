import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import { Stress } from "../phonetics/pronunciation";
import { emphasise, IssueList, plural, type CheckReport } from "./check-result";
import { LyricSetter, type LyricSetting } from "./lyric-setter";
import { melodyLine, median } from "./melody-line";
import { COMMON_TIME, Meter, METRICAL_WEIGHT } from "./meter";
import { NoteWeigher, type WeightedNote } from "./note-weigher";
import type { PlannedSyllable } from "./option-chooser";

/** A stressed syllable must be at least this much weaker than its unstressed neighbour to count as an inversion. */
const INVERSION_MARGIN = 0.05;
const WORD_INVERSION_PENALTY = 1;
const PHRASE_INVERSION_PENALTY = 0.6;
const SECONDARY_STRESS_FACTOR = 0.5;
const WEAK_SYLLABLE_HELD_PENALTY = 0.4;
const STRESS_LOST_PENALTY = 0.3;
const PER_UNMATCHED_NOTE_PENALTY = 0.2;
const MAX_COUNT_PENALTY = 1;
/** The longest note of a line stands out when it is at least this many times the typical length. */
const HELD_FACTOR = 1.5;
/** A sixteenth note, in beats. */
const SHORT_NOTE_BEATS = 0.25;
const MIN_SYLLABLES_FOR_HELD_CHECK = 3;

/**
 * Checks how a lyric line sits on a melody: stressed syllables should be on stronger notes than
 * their unstressed neighbours (weight from position in the bar, length and melodic peaks).
 */
export class ProsodyChecker {
  private readonly setter: LyricSetter;
  private readonly weigher: NoteWeigher;

  constructor(meter: Meter) {
    this.setter = new LyricSetter(meter);
    this.weigher = new NoteWeigher(meter);
  }

  check(line: LineAnalysis, notes: Note[]): CheckReport {
    const setting = this.setter.set(line, notes);
    const { syllables } = setting;
    const sung = this.notesBySyllable(setting);
    const issues = new IssueList();
    this.checkCount(issues, setting, melodyLine(notes).length);
    if (setting.alignment.length > 0) {
      this.checkInversions(issues, syllables, sung);
      this.checkWeakSyllablesHeld(issues, syllables, sung);
      this.checkLostStress(issues, syllables, sung);
    }
    return { ...issues.result(syllables.length), syllables, notes: setting.notes, alignment: setting.alignment };
  }

  private notesBySyllable(setting: LyricSetting): WeightedNote[][] {
    const weights = this.weigher.weigh(setting.notes);
    const sung: WeightedNote[][] = setting.syllables.map(() => []);
    for (const { syllable, note } of setting.alignment) {
      const weighted = weights[note];
      if (weighted) sung[syllable]?.push(weighted);
    }
    return sung;
  }

  private checkCount(issues: IssueList, setting: LyricSetting, noteCount: number): void {
    const syllableCount = setting.syllables.length;
    const difference = syllableCount - noteCount;
    const penalty = Math.min(MAX_COUNT_PENALTY, Math.abs(difference) * PER_UNMATCHED_NOTE_PENALTY);
    if (difference > 0) {
      issues.add(
        setting.splitSyllables[0] ?? 0,
        `The line has ${plural(syllableCount, "syllable")} but the melody has ${plural(noteCount, "note")}, so some notes have to be split.`,
        `Add ${plural(difference, "note")} to the melody, or cut ${plural(difference, "syllable")} with a shorter word or a contraction.`,
        penalty,
      );
    } else if (difference < 0) {
      const first = setting.melismaSyllables[0] ?? 0;
      const text = setting.syllables[first]?.text ?? "";
      issues.add(
        first,
        `The line has ${plural(syllableCount, "syllable")} for ${plural(noteCount, "note")}, so some syllables are sung over several notes (melismas), starting on "${text}".`,
        "That works on an open, stressed vowel; otherwise add a word or merge notes.",
        penalty,
      );
    }
  }

  private checkInversions(issues: IssueList, syllables: PlannedSyllable[], sung: WeightedNote[][]): void {
    for (let index = 0; index + 1 < syllables.length; index++) {
      const first = syllables[index];
      const second = syllables[index + 1];
      const firstWeight = sung[index]?.[0]?.weight;
      const secondWeight = sung[index + 1]?.[0]?.weight;
      if (!first || !second || firstWeight === undefined || secondWeight === undefined) continue;
      if (first.stress !== Stress.None && second.stress === Stress.None && firstWeight + INVERSION_MARGIN < secondWeight) {
        this.reportInversion(issues, syllables, index, index + 1);
      } else if (second.stress !== Stress.None && first.stress === Stress.None && secondWeight + INVERSION_MARGIN < firstWeight) {
        this.reportInversion(issues, syllables, index + 1, index);
      }
    }
  }

  private reportInversion(issues: IssueList, syllables: PlannedSyllable[], stressedIndex: number, weakIndex: number): void {
    const stressed = syllables[stressedIndex];
    const weak = syllables[weakIndex];
    if (!stressed || !weak) return;
    const factor = stressed.stress === Stress.Secondary ? SECONDARY_STRESS_FACTOR : 1;
    if (stressed.word === weak.word) {
      issues.add(
        stressedIndex,
        `"${stressed.wordText}" is stressed on "${stressed.text}", but "${weak.text}" lands on a stronger beat, so it may sound like "${emphasise(syllables, weak.word, weakIndex)}".`,
        `Move "${stressed.text}" onto the beat (start the word earlier if needed), or choose a word whose stress fits this rhythm.`,
        WORD_INVERSION_PENALTY * factor,
      );
      return;
    }
    issues.add(
      stressedIndex,
      `The stressed "${stressed.text}" (in "${stressed.wordText}") sits on a weaker spot than the unstressed "${weak.text}" next to it.`,
      `Shift the line so "${stressed.text}" falls on a beat and "${weak.text}" on an off-beat, or reorder the words.`,
      PHRASE_INVERSION_PENALTY * factor,
    );
  }

  private checkWeakSyllablesHeld(issues: IssueList, syllables: PlannedSyllable[], sung: WeightedNote[][]): void {
    if (syllables.length < MIN_SYLLABLES_FOR_HELD_CHECK) return;
    const lengths = sung.map((notes) => notes.reduce((sum, weighted) => sum + weighted.note.duration, 0));
    const typical = median(lengths);
    const longest = Math.max(...lengths);
    const pitches = sung.flatMap((notes) => notes.map((weighted) => weighted.note.pitch));
    const highest = Math.max(...pitches);
    const pitchVaries = pitches.some((pitch) => pitch !== highest);
    syllables.forEach((syllable, index) => {
      if (syllable.stress !== Stress.None || issues.has(index)) return;
      const held = lengths[index] === longest && longest >= HELD_FACTOR * typical;
      const peak = pitchVaries && (sung[index] ?? []).some((weighted) => weighted.note.pitch === highest);
      if (!held && !peak) return;
      const strong = this.nearestStressed(syllables, index);
      issues.add(
        index,
        `The unstressed "${syllable.text}" gets the ${held ? "longest" : "highest"} note of the line, which puts weight on a weak syllable.`,
        strong
          ? `Give that note to a stressed syllable such as "${strong.text}", or shorten "${syllable.text}".`
          : `Shorten "${syllable.text}" or move the ${held ? "long" : "high"} note to a stressed word.`,
        WEAK_SYLLABLE_HELD_PENALTY,
      );
    });
  }

  private checkLostStress(issues: IssueList, syllables: PlannedSyllable[], sung: WeightedNote[][]): void {
    syllables.forEach((syllable, index) => {
      if (syllable.stress !== Stress.Primary || syllable.functionWord || issues.has(index)) return;
      const first = sung[index]?.[0];
      if (!first || first.metrical > METRICAL_WEIGHT.subdivision || first.note.duration > SHORT_NOTE_BEATS) return;
      issues.add(
        index,
        `"${syllable.text}" is stressed but sits on a short sixteenth off-beat, so it may get lost.`,
        "Move it to a beat or an eighth-note off-beat, or give it a longer note.",
        STRESS_LOST_PENALTY,
      );
    });
  }

  private nearestStressed(syllables: PlannedSyllable[], index: number): PlannedSyllable | undefined {
    for (let distance = 1; distance < syllables.length; distance++) {
      for (const candidate of [syllables[index + distance], syllables[index - distance]]) {
        if (candidate && candidate.stress === Stress.Primary) return candidate;
      }
    }
    return undefined;
  }
}

/** Prosody score and issues (with fixes in plain words) for a line set to notes. */
export function prosodyCheck(
  line: LineAnalysis,
  notes: Note[],
  beatsPerBar: number = COMMON_TIME.numerator,
  beatUnit: number = COMMON_TIME.denominator,
): CheckReport {
  return new ProsodyChecker(new Meter(beatsPerBar, beatUnit)).check(line, notes);
}
