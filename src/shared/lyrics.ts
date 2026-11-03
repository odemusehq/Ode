/** Literal shared lyrics. Syllables, stress, rhyme and other interpretation come from Lyricist separately. */
export interface LyricsState {
  /** The song the lyrics belong to. */
  songId: string;
  text: string;
  revision: number;
  /** The names of the sections that ask for perfect rhymes. */
  strictRhymes: string[];
  /** Saved model annotations for this exact text and interpretation context, when already available. */
  check?: LyricsCheck;
  /** The same saved syllable choices and native melody associations that Ode reads. */
  notation?: import("./lyrics-document").LyricsNotation;
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
  /** IPA for each sung syllable, when the model or musician supplied it. */
  ipa?: string[];
}

/** The rhyme the editor colours at a line's end. */
export interface RhymeCheck {
  /** "A", "B"… in the whole song's sound groups; empty for a line without a rhyming partner. */
  letter: string;
  quality: "perfect" | "near" | "none";
  /** The letters of the last word that carry the rhyme, such as "ide" in "inside"; empty without a rhyme. */
  part: string;
  /** Lyricist's phonetic reading from the stressed vowel onward; empty when uncertain. */
  sound: string;
}

export interface LineCheck {
  words: WordCheck[];
  rhyme: RhymeCheck;
}

/** Lyrics support's marks for the whole song, one entry per line sent, in order. */
export interface LyricsCheck {
  lines: LineCheck[];
}

/** The whole song to check: its sung lines, with labels and blank lines left out. */
export interface LyricsCheckRequest {
  lines: string[];
}

/** The marks, or why Lyrics support is quiet: a provider or key still to set, or a model out of reach. */
export type LyricsCheckResponse = { status: "ok"; check: LyricsCheck } | { status: "setup" } | { status: "unreachable"; detail: string };
