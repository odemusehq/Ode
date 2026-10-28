import type { ReactNode } from "react";
import type { LineAnalysis, LyricsNote, WordAnalysis } from "../../shared/lyrics";
import { Badge } from "./Badge";
import { cx } from "./cx";
import { formatSyllableCounts } from "./format";
import { STRESS_MARKS } from "./stress";
import { Tone } from "./types";
import "./LyricLine.css";

type LyricsNoteKind = LyricsNote["kind"];

const NOTE_LABELS: Record<LyricsNoteKind, string> = {
  cliche: "Cliché",
  prosody: "Prosody",
  uncertain: "Pronunciation",
  rhyme: "Rhyme",
};

const NOTE_TONES: Record<LyricsNoteKind, Tone> = {
  cliche: Tone.Warning,
  prosody: Tone.Info,
  uncertain: Tone.Warning,
  rhyme: Tone.Info,
};

const NO_RHYME = "-";
const UNCERTAIN_NOTE = "Includes a word whose pronunciation is not certain.";

/** The syllable count a line has to match, and why. */
export interface SyllableTarget {
  counts: readonly number[];
  /** Where the target comes from, e.g. "Verse 1, line 3 has 8 syllables". */
  reason: string;
}

export interface LyricLineProps {
  /** The line's text, or an editor for it. */
  children: ReactNode;
  /** Analysis of this line; null while it is being checked. */
  analysis: LineAnalysis | null;
  /** Rhyme-scheme letter of the line. */
  rhyme?: string;
  notes?: readonly LyricsNote[];
  /** The count the line should have; the count turns red when no reading of the line matches it. */
  target?: SyllableTarget;
  /** Tapping a red count calls this, to have the line rewritten to fit. */
  onFit?: () => void;
  /** Controls at the end of the line, such as a lock. */
  actions?: ReactNode;
}

/** A lyric line with its syllables, stress marks, syllable count, rhyme letter and notes. */
export function LyricLine({ children, analysis, rhyme, notes = [], target, onFit, actions }: LyricLineProps) {
  const words = analysis?.words ?? [];
  const uncertain = words.some((word) => !word.certain);

  return (
    <div className="ode-lyric">
      <div className="ode-lyric__row">
        <span className="ode-lyric__rhyme">
          {rhyme && rhyme !== NO_RHYME && (
            <Badge tone={Tone.Info} title="Rhyme scheme">
              {rhyme}
            </Badge>
          )}
        </span>
        <div className="ode-lyric__text">{children}</div>
        {analysis && words.length > 0 ? (
          <SyllableCount counts={analysis.counts} uncertain={uncertain} target={target} onFit={onFit} />
        ) : (
          <span className="ode-lyric__count" />
        )}
        {actions && <div className="ode-lyric__actions">{actions}</div>}
      </div>
      {words.length > 0 && (
        <div className="ode-lyric__words">
          {words.map((word, index) => (
            <LyricWord key={index} word={word} />
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <ul className="ode-lyric__notes">
          {notes.map((note, index) => (
            <li key={index} className="ode-lyric__note">
              <Badge tone={NOTE_TONES[note.kind]}>{NOTE_LABELS[note.kind]}</Badge>
              <span>{note.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SyllableCountProps {
  counts: readonly number[];
  uncertain: boolean;
  target?: SyllableTarget;
  onFit?: () => void;
}

/** "7", or "9/8" against a target: red when no reading of the line has the target's count. */
function SyllableCount({ counts, uncertain, target, onFit }: SyllableCountProps) {
  const text = formatSyllableCounts(counts);
  if (!target) {
    return (
      <span
        className={cx("ode-lyric__count", uncertain && "ode-lyric__count--uncertain")}
        title={uncertain ? `Syllables. ${UNCERTAIN_NOTE}` : "Syllables"}
      >
        {text}
        <span className="ode-visually-hidden"> syllables</span>
      </span>
    );
  }

  const fits = counts.some((count) => target.counts.includes(count));
  const shown = `${text}/${formatSyllableCounts(target.counts)}`;
  const spoken = `${text} syllables, ${formatSyllableCounts(target.counts)} wanted`;
  const title = [`${target.reason}.`, uncertain && UNCERTAIN_NOTE].filter(Boolean).join(" ");

  if (fits || !onFit) {
    return (
      <span className={cx("ode-lyric__count", !fits && "ode-lyric__count--off")} title={title}>
        <span aria-hidden="true">{shown}</span>
        <span className="ode-visually-hidden">{fits ? spoken : `${spoken}, doesn't fit`}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="ode-lyric__count ode-lyric__count--off ode-lyric__fit"
      title={`${title} Tap to rewrite this line to fit.`}
      aria-label={`${spoken}. Rewrite this line to fit`}
      onClick={onFit}
    >
      {shown}
    </button>
  );
}

interface LyricWordProps {
  word: WordAnalysis;
}

function LyricWord({ word }: LyricWordProps) {
  const syllables = word.options[0]?.syllables ?? [];
  const counts = [...new Set(word.options.map((option) => option.syllables.length))];
  const hasOptions = counts.length > 1;
  const title = [!word.certain && "Pronunciation not certain", hasOptions && `Sung as ${counts.join(" or ")} syllables`]
    .filter(Boolean)
    .join(". ");

  return (
    <span
      className={cx("ode-lyric__word", !word.certain && "ode-lyric__word--uncertain", hasOptions && "ode-lyric__word--options")}
      title={title || undefined}
    >
      {syllables.map((syllable, index) => (
        <span key={index} className={cx("ode-lyric__syllable", syllable.stress > 0 && "ode-lyric__syllable--stressed")}>
          <span className="ode-lyric__mark" aria-hidden="true">
            {STRESS_MARKS[syllable.stress]}
          </span>
          <span className="ode-lyric__syllable-text">{syllable.text}</span>
        </span>
      ))}
      {!word.certain && <span className="ode-visually-hidden"> (pronunciation not certain)</span>}
    </span>
  );
}
