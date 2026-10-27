// Ode's music code for words and notes. Audio analysis lives in ./audio with its own index.

export { pronounce } from "./phonetics/pronounce";
export { Lexicon } from "./phonetics/lexicon";
export type { Pronunciation, StressLevel } from "./phonetics/pronunciation";
export { syllabify } from "./phonetics/syllabify";
export { spellSyllables } from "./phonetics/syllable-speller";
export { analyzeLine, LineAnalyzer } from "./phonetics/line-analyzer";
export { formatIpa } from "./phonetics/ipa";
export { isFunctionWord } from "./phonetics/function-words";

export { RhymeKind, type RhymeResult } from "./rhyme/rhyme-kind";
export { compareRhyme, RhymeComparer } from "./rhyme/rhyme-comparer";
export { analyzeScheme, rhymeScheme, RhymeSchemeBuilder, type InternalRhyme, type RhymePair, type SchemeAnalysis } from "./rhyme/rhyme-scheme";
export { findRhymes, RhymeIndex, type FindRhymesOptions, type RhymeSuggestion } from "./rhyme/rhyme-index";

export { Meter, METRICAL_WEIGHT } from "./prosody/meter";
export { setLyricsToMelody, LyricSetter, type LyricSetting, type SyllableNote } from "./prosody/lyric-setter";
export { prosodyCheck, ProsodyChecker } from "./prosody/prosody-checker";
export { singabilityCheck, SingabilityChecker } from "./prosody/singability-checker";
export type { CheckIssue, CheckReport, CheckResult } from "./prosody/check-result";
export type { PlannedSyllable } from "./prosody/option-chooser";
export { analyzeLyrics, LyricsAnalyzer } from "./prosody/lyrics-analyzer";

export { writeMelody, MelodyWriter } from "./melody/melody-writer";
export { varyMelody, MelodyVarier } from "./melody/melody-varier";
export { Contour, MelodyVariation, Register, type MelodyPlan } from "./melody/melody-plan";

export { harmonize, Harmonizer, type HarmonizeOptions, type Progression } from "./harmony/harmonizer";
export { voiceChords, ChordVoicer, DEFAULT_VOICING_REGISTER, type Voicing, type VoicingOptions } from "./harmony/chord-voicer";
export { MusicalKey, type KeySpec } from "./harmony/musical-key";
export { KeyFinder } from "./harmony/key-finder";
export { ChordSymbol } from "./harmony/chord-symbol";
export type { PitchRange } from "./harmony/pitch-range";

export { drumGroove, DrumGrooveWriter } from "./rhythm/drum-groove-writer";
export { bassline, BasslineWriter, BassStyle, parseBassStyle } from "./rhythm/bassline-writer";
export { DrumNote, drumMap } from "./rhythm/drum-kit";
export { Genre, parseGenre } from "./rhythm/genre";

export { planSongForm, SongFormPlanner, type SongFormPlan } from "./form/song-form-planner";

export { harmonyLines, HarmonyVoiceWriter } from "./vocals/harmony-lines";

export { originalityCheck, OriginalityChecker, QuoteRisk, type OriginalityReport } from "./originality/originality-checker";
