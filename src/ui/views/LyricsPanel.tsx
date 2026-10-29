import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { LyricsState, WordAnalysis } from "../../shared/lyrics";
import { Button, cx } from "../../ui-kit";
import { useClient, useLyrics } from "../app/hooks";
import { LineDiff } from "../app/line-diff";
import { checkedLines } from "./lyrics-checks";
import type { CheckedLine } from "./lyrics-checks";
import { TOP_OF_TEXT, TextCaret } from "./text-caret";
import type { TextSelection } from "./text-caret";
import "./LyricsPanel.css";


/** The song's lyrics as one text that the musician and Ode both edit, with each sung line's checks beside it. */
export function LyricsPanel() {
  const client = useClient();
  const { text, stored, replaced, saveError, loadError } = useLyrics();
  const titleId = useId();

  return (
    <section className="lyrics" aria-labelledby={titleId}>
      <h2 id={titleId} className="ode-visually-hidden">
        Lyrics
      </h2>
      {stored ? (
        <LyricsEditor text={text} stored={stored} replaced={replaced} />
      ) : loadError ? (
        <ProblemLine message={loadError} onRetry={() => void client.lyrics.load()} />
      ) : (
        <p className="lyrics__reading">Reading the lyrics…</p>
      )}
      {saveError && <ProblemLine message={saveError} onRetry={() => client.lyrics.retrySave()} />}
    </section>
  );
}

interface LyricsEditorProps {
  text: string;
  stored: LyricsState;
  /** Goes up when the stored text replaced the editor's. */
  replaced: number;
}

/**
 * A plain text editor without wrapping, one line per row, with a gutter of syllable counts, rhyme letters and a
 * mark on lines with a note; under it, the stress pattern and notes of the line the caret is on.
 */
function LyricsEditor({ text, stored, replaced }: LyricsEditorProps) {
  const client = useClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const selection = useRef<TextSelection>(TOP_OF_TEXT);
  const shown = useRef({ text, replaced });
  const [caretLine, setCaretLine] = useState(0);
  const lines = useMemo(() => LineDiff.lines(text), [text]);
  const checked = useMemo(() => checkedLines(lines, stored), [lines, stored]);

  // When the stored text replaces the editor's (Ode saved in between), the caret keeps its line and column.
  useLayoutEffect(() => {
    const element = textarea.current;
    if (element && replaced !== shown.current.replaced && document.activeElement === element) {
      const scrollTop = element.scrollTop;
      selection.current = TextCaret.carry(element, shown.current.text, text, selection.current);
      element.scrollTop = scrollTop;
      setCaretLine(selection.current.start.line);
    }
    shown.current = { text, replaced };
    if (element && gutter.current) gutter.current.scrollTop = element.scrollTop;
  });

  const remember = (element: HTMLTextAreaElement) => {
    selection.current = TextCaret.selectionOf(element);
    setCaretLine(selection.current.start.line);
  };

  const change = (event: ChangeEvent<HTMLTextAreaElement>) => {
    remember(event.currentTarget);
    client.lyrics.edit(event.currentTarget.value);
  };

  return (
    <>
      <div className="lyrics-editor">
        <div ref={gutter} className="lyrics-editor__gutter" aria-hidden="true">
          {checked.map((line, index) => (
            <div key={index} className={cx("lyrics-editor__row", index === caretLine && "lyrics-editor__row--current")}>
              <span className="lyrics-editor__count">{line.count}</span>
              <span className="lyrics-editor__rhyme">{line.rhyme}</span>
              <span className={cx("lyrics-editor__mark", line.notes.length > 0 && "lyrics-editor__mark--noted")} />
            </div>
          ))}
        </div>
        <textarea
          ref={textarea}
          className="lyrics-editor__text"
          aria-label="Lyrics"
          placeholder="Write the lyrics"
          value={text}
          wrap="off"
          spellCheck={false}
          onChange={change}
          onSelect={(event) => remember(event.currentTarget)}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
          }}
        />
      </div>
      <CaretLine line={checked[caretLine]} />
    </>
  );
}

interface CaretLineProps {
  line: CheckedLine | undefined;
}

/** The line the caret is on: its syllables with the stressed ones in bold, and its notes. */
function CaretLine({ line }: CaretLineProps) {
  const words = line?.analysis?.words ?? [];
  return (
    <div className="lyrics-line">
      {words.length > 0 && (
        <p className="lyrics-line__stress">
          <span className="ode-visually-hidden">Stress: {spokenStress(words)}</span>
          {words.map((word, index) => (
            <StressedWord key={index} word={word} />
          ))}
        </p>
      )}
      {line?.notes.map((note, index) => (
        <p key={index} className="lyrics-line__note">
          {note.message}
        </p>
      ))}
    </div>
  );
}

interface StressedWordProps {
  word: WordAnalysis;
}

function StressedWord({ word }: StressedWordProps) {
  const syllables = word.options[0]?.syllables ?? [];
  return (
    <span className={cx("lyrics-line__word", !word.certain && "lyrics-line__word--uncertain")} aria-hidden="true">
      {syllables.map((syllable, index) => (
        <span key={index} className={cx("lyrics-line__syllable", syllable.stress === 1 && "lyrics-line__syllable--stressed", syllable.stress === 2 && "lyrics-line__syllable--secondary")}>
          {syllable.text}
        </span>
      ))}
    </span>
  );
}

/** Stressed syllables in capitals, as songwriters mark them: "i WALKED a-LONG the RI-ver". */
function spokenStress(words: readonly WordAnalysis[]): string {
  return words
    .map((word) =>
      (word.options[0]?.syllables ?? [])
        .map((syllable) => (syllable.stress === 1 ? syllable.text.toUpperCase() : syllable.text.toLowerCase()))
        .join("-"),
    )
    .join(" ");
}

interface ProblemLineProps {
  message: string;
  onRetry: () => void;
}

function ProblemLine({ message, onRetry }: ProblemLineProps) {
  return (
    <div className="lyrics__problem" role="alert">
      <p className="lyrics__problem-text">{message}</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
