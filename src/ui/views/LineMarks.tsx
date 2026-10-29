import type { LineCheck } from "../../shared/lyrics";
import { cx, type CSSVariables } from "../../ui-kit";
import { MarkLayout, type MarkRun } from "./mark-layout";

/** The rhyme colours: one per letter, A to F, then round again. */
class RhymeColour {
  private static readonly COUNT = 6;

  /** The colour token's suffix for a rhyme letter: "a" for A, "b" for B… */
  static of(letter: string): string {
    const index = (letter.toUpperCase().charCodeAt(0) - "A".charCodeAt(0)) % RhymeColour.COUNT;
    return String.fromCharCode("a".charCodeAt(0) + Math.max(0, index));
  }
}

export interface LineMarksProps {
  /** The line as typed. */
  line: string;
  check: LineCheck | null;
  /** The section asks for perfect rhymes, so a near one is flagged. */
  strict: boolean;
}

/**
 * Lyrics support's marks for one line, drawn behind the text field's line: bars between syllables, a dot under each
 * stressed syllable, the rhyming letters in the rhyme's colour, and the count and rhyme letter at the line's end.
 */
export function LineMarks({ line, check, strict }: LineMarksProps) {
  const rhyme = check?.rhyme;
  const colour: CSSVariables | undefined = rhyme?.letter ? { "--rhyme-rgb": `var(--rhyme-${RhymeColour.of(rhyme.letter)})` } : undefined;
  const near = rhyme?.quality === "near";
  const rhymeClass = cx("mark-rhyme", near && "mark-rhyme--near", near && strict && "mark-rhyme--flagged");
  return (
    <div className="line-marks" style={colour}>
      <span className="line-marks__text">
        {MarkLayout.runs(line, check).map((run, index) => (
          <Run key={index} run={run} rhymeClass={rhymeClass} />
        ))}
      </span>
      {check && (
        <span className="line-marks__meta">
          <span className="line-marks__letter">
            {rhyme?.letter && (
              <>
                <i className={cx("line-marks__dot", near && "line-marks__dot--near")} />
                {rhyme.letter}
              </>
            )}
          </span>
          <span className="line-marks__count">{MarkLayout.count(check)}</span>
        </span>
      )}
    </div>
  );
}

interface RunProps {
  run: MarkRun;
  rhymeClass: string;
}

function Run({ run, rhymeClass }: RunProps) {
  const pieces = run.rhyme ? (
    <>
      {run.text.slice(0, run.rhyme[0])}
      <span className={rhymeClass}>{run.text.slice(run.rhyme[0], run.rhyme[1])}</span>
      {run.text.slice(run.rhyme[1])}
    </>
  ) : (
    run.text
  );
  if (!run.syllable) return <>{pieces}</>;
  return (
    <span className={cx("mark-syllable", run.syllable.stressed && "mark-syllable--stressed")}>
      {run.syllable.barBefore && <i className="mark-bar" />}
      {pieces}
    </span>
  );
}
