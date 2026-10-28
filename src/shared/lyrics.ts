// Shape of lyric analysis shared by the music code, the tools and the UI.
import type { Note } from "./live";

export interface SyllableInfo {
  /** The spelling of this syllable, for display. */
  text: string;
  /** IPA phonemes. */
  phonemes: string[];
  /** 1 primary, 2 secondary, 0 unstressed, after phrase stress is applied. */
  stress: 0 | 1 | 2;
}

export interface WordOption {
  syllables: SyllableInfo[];
}

export interface WordAnalysis {
  text: string;
  /** Every valid pronunciation; sung words can have more than one syllable count. */
  options: WordOption[];
  /** False when the pronunciation came from letter-to-sound rules or the model. */
  certain: boolean;
}

export interface LineAnalysis {
  text: string;
  words: WordAnalysis[];
  /** Every possible syllable count for the line, ascending. */
  counts: number[];
}

export interface LyricsNote {
  line: number;
  kind: "cliche" | "prosody" | "uncertain" | "rhyme";
  message: string;
}

export interface LyricsAnalysis {
  lines: LineAnalysis[];
  /** Rhyme-scheme letter per line ("A", "B"…); "-" for lines with no rhyme partner. */
  scheme: string[];
  notes: LyricsNote[];
}

/** A syllable shown under a note; "_" marks a note that holds the syllable before it (a melisma). */
export interface SungSyllable {
  text: string;
  stress: 0 | 1 | 2;
  /** True when the prosody check found a problem on this syllable. */
  problem: boolean;
}

/** One lyric line set to its phrase of the melody. */
export interface MelodyLine {
  /** The line's id in the lead sheet. */
  line: string;
  text: string;
  /** The phrase the line is sung on, in beats from the start of the section. */
  notes: Note[];
  /** What is sung on each note of `notes`, by index; null for a note left without a syllable. */
  marks: (SungSyllable | null)[];
  /** Syllables in the chosen pronunciation, and notes in the phrase. */
  syllables: number;
  noteCount: number;
  /** 0–1 from the prosody check; 1 means no problems. */
  score: number;
  issues: { problem: string; fix: string }[];
}

/** A section's lines set to the notes of the melody clip, for "Set to melody" in the Lyrics tab. */
export interface MelodySetting {
  /** The section's id in the lead sheet. */
  section: string;
  /** Where the melody came from, as "Lead · clip Hook A". */
  clip: string;
  lengthBeats: number;
  lines: MelodyLine[];
}
