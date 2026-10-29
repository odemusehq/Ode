import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import { isClosedVowel } from "../phonetics/phoneme";
import { IssueList, type CheckReport } from "./check-result";
import { LyricSetter, type LyricSetting } from "./lyric-setter";
import { median } from "./melody-line";
import { COMMON_TIME, Meter } from "./meter";
import type { PlannedSyllable } from "./option-chooser";

/** A note at least this long (in beats), or twice the line's typical length, counts as long. */
const LONG_NOTE_BEATS = 1;
const LONG_FACTOR = 2;
/** A note at least this many semitones above the line's middle pitch counts as high. */
const HIGH_NOTE_SEMITONES = 5;
/** A sixteenth note, in beats: too short for a cluster of consonants. */
const VERY_SHORT_BEATS = 0.25;
const CLUSTER_CONSONANTS = 3;
/** A rest at least this long (in beats) gives the singer a breath; phrases longer than the limit need one. */
const BREATH_REST_BEATS = 0.5;
const PHRASE_WITHOUT_BREATH_BEATS = 8;

const CLOSED_HIGH_LONG_PENALTY = 1;
const CLOSED_HIGH_OR_LONG_PENALTY = 0.4;
const CLUSTER_PENALTY = 0.5;
const BREATH_PENALTY = 0.5;

/** Familiar spellings of vowel sounds for messages. */
const VOWEL_SOUNDS: ReadonlyMap<string, string> = new Map([
  ["i", "ee"],
  ["iː", "ee"],
  ["ɪ", "ih"],
  ["u", "oo"],
  ["uː", "oo"],
  ["ʊ", "oo (as in \"book\")"],
  ["ɝ", "er"],
  ["ɚ", "er"],
  ["ɜː", "er"],
  ["ɪə", "eer"],
  ["ʊə", "oor"],
]);

interface SungSyllable {
  syllable: PlannedSyllable;
  index: number;
  notes: Note[];
  length: number;
  top: number;
}

/**
 * Checks how easy a line is to sing on its melody: open vowels suit long or high notes, closed
 * vowels on high sustained notes are hard, consonant clusters crowd very short notes, and long
 * phrases need somewhere to breathe.
 */
export class SingabilityChecker {
  private readonly setter: LyricSetter;

  constructor(meter: Meter) {
    this.setter = new LyricSetter(meter);
  }

  check(line: LineAnalysis, notes: Note[]): CheckReport {
    const setting = this.setter.set(line, notes);
    const sung = this.sungSyllables(setting);
    const issues = new IssueList();
    if (setting.alignment.length > 0) {
      this.checkVowels(issues, sung, setting.notes);
      this.checkClusters(issues, sung);
      this.checkBreath(issues, setting);
    }
    return { ...issues.result(setting.syllables.length), syllables: setting.syllables, notes: setting.notes, alignment: setting.alignment };
  }

  private sungSyllables(setting: LyricSetting): SungSyllable[] {
    return setting.syllables.map((syllable, index) => {
      const notes = setting.alignment
        .filter((entry) => entry.syllable === index)
        .map((entry) => setting.notes[entry.note])
        .filter((note): note is Note => note !== undefined);
      return {
        syllable,
        index,
        notes,
        length: notes.reduce((sum, note) => sum + note.duration, 0),
        top: notes.reduce((highest, note) => Math.max(highest, note.pitch), Number.NEGATIVE_INFINITY),
      };
    });
  }

  private checkVowels(issues: IssueList, sung: SungSyllable[], notes: Note[]): void {
    if (notes.length === 0) return;
    const typicalLength = median(notes.map((note) => note.duration));
    const middlePitch = median(notes.map((note) => note.pitch));
    const highest = Math.max(...notes.map((note) => note.pitch));
    const longThreshold = Math.max(LONG_NOTE_BEATS, LONG_FACTOR * typicalLength);
    for (const item of sung) {
      if (item.notes.length === 0 || !isClosedVowel(item.syllable.vowel)) continue;
      const long = item.length >= longThreshold;
      const high = item.top >= middlePitch + HIGH_NOTE_SEMITONES || (item.top === highest && highest > middlePitch);
      if (!long && !high) continue;
      const sound = VOWEL_SOUNDS.get(item.syllable.vowel) ?? item.syllable.vowel;
      if (long && high) {
        issues.add(
          item.index,
          `"${item.syllable.wordText}" puts the closed "${sound}" vowel on a long high note; it is hard to sustain and tends to sound pinched.`,
          'Use a word with an open vowel there (like "ah", "oh", "ay" or "eye"), or move the long high note to another syllable.',
          CLOSED_HIGH_LONG_PENALTY,
        );
      } else {
        issues.add(
          item.index,
          `"${item.syllable.wordText}" has the closed "${sound}" vowel on a ${long ? "long" : "high"} note; singers often have to open it up.`,
          `An open vowel sings more easily on a ${long ? "long" : "high"} note; consider a word with "ah", "oh" or "ay", or keep it and let the singer modify the vowel.`,
          CLOSED_HIGH_OR_LONG_PENALTY,
        );
      }
    }
  }

  private checkClusters(issues: IssueList, sung: SungSyllable[]): void {
    for (const item of sung) {
      const first = item.notes[0];
      const consonants = item.syllable.onsetLength + item.syllable.codaLength;
      if (!first || first.duration > VERY_SHORT_BEATS || consonants < CLUSTER_CONSONANTS) continue;
      issues.add(
        item.index,
        `"${item.syllable.text}" (in "${item.syllable.wordText}") packs ${consonants} consonants onto a very short note.`,
        "Give it a longer note, or use a word with fewer consonants here.",
        CLUSTER_PENALTY,
      );
    }
  }

  private checkBreath(issues: IssueList, setting: LyricSetting): void {
    const { notes, alignment } = setting;
    let phraseStart = notes[0]?.start ?? 0;
    for (let index = 0; index < notes.length; index++) {
      const note = notes[index];
      const previous = notes[index - 1];
      if (!note) continue;
      if (previous && note.start - (previous.start + previous.duration) >= BREATH_REST_BEATS) phraseStart = note.start;
      if (note.start + note.duration - phraseStart <= PHRASE_WITHOUT_BREATH_BEATS) continue;
      const syllable = alignment.find((entry) => entry.note === index)?.syllable ?? 0;
      const text = setting.syllables[syllable]?.text ?? "";
      issues.add(
        syllable,
        `The line runs more than ${PHRASE_WITHOUT_BREATH_BEATS} beats without a place to breathe.`,
        `Leave a short rest (about half a beat) around "${text}", for example between two phrases of the line.`,
        BREATH_PENALTY,
      );
      return;
    }
  }
}

/** Singability score and issues (with fixes in plain words) for a line set to notes. */
export function singabilityCheck(
  line: LineAnalysis,
  notes: Note[],
  beatsPerBar: number = COMMON_TIME.numerator,
  beatUnit: number = COMMON_TIME.denominator,
): CheckReport {
  return new SingabilityChecker(new Meter(beatsPerBar, beatUnit)).check(line, notes);
}
