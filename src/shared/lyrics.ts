// Shape of lyric analysis shared by the music code, the tools and the UI.

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
  /** Rhyme-scheme letter per line ("A", "B"…); "-" for lines without a rhyme partner. */
  scheme: string[];
  notes: LyricsNote[];
}

/**
 * The shared lyrics as stored, with their analysis. analysis.lines[i] belongs to line i of the text; blank lines
 * and [label] lines have empty word lists.
 */
export interface LyricsState {
  /** The song the lyrics belong to. */
  songId: string;
  text: string;
  revision: number;
  analysis: LyricsAnalysis;
  /** The names of the sections that ask for perfect rhymes. */
  strictRhymes: string[];
}

/** Turns perfect rhymes on or off for every section with this name. */
export interface StrictRhymesRequest {
  name: string;
  strict: boolean;
}

/**
 * A save of the lyrics from the window or from Ode: the whole new text, the revision it was edited from, and the song
 * it was edited in, so a save that arrives after the musician opened another song stays with its own.
 */
export interface LyricsWrite {
  songId?: string;
  text: string;
  baseRevision: number;
}

/**
 * A save as stored. When someone else saved since baseRevision, both sets of changes are merged line by line;
 * where both changed the same lines, the musician's lines are kept and listed in `conflicts` (line numbers from 1).
 */
export interface LyricsSaved extends LyricsState {
  conflicts: number[];
}

/** How the Lyrics editor marks one word: its sung syllables as spelling pieces, and each one's stress (1 main, 2 secondary, 0 light). */
export interface WordCheck {
  text: string;
  syllables: string[];
  stress: number[];
}

/** The rhyme the editor colours at a line's end. */
export interface RhymeCheck {
  /** "A", "B"… in the section's scheme; empty for a line without a rhyming partner. */
  letter: string;
  quality: "perfect" | "near" | "none";
  /** The letters of the last word that carry the rhyme, such as "ide" in "inside"; empty without a rhyme. */
  part: string;
}

export interface LineCheck {
  words: WordCheck[];
  rhyme: RhymeCheck;
}

/** Lyrics support's marks for one section, one entry per line sent, in order. */
export interface LyricsCheck {
  lines: LineCheck[];
}

/** A section to check: its sung lines, with labels and blank lines left out. */
export interface LyricsCheckRequest {
  lines: string[];
}

/** The marks, or why Lyrics support is quiet: a provider or key still to set, or a model out of reach. */
export type LyricsCheckResponse = { status: "ok"; check: LyricsCheck } | { status: "setup" } | { status: "unreachable"; detail: string };
