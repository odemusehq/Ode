import type { MelodyLine, MelodySetting } from "../../shared/lyrics";
import type { Section } from "../../shared/song";
import { Button, ButtonVariant, Chip, ChipGroup, PianoRoll, cx } from "../../ui-kit";
import { beatsPerBar } from "../app/format";
import { useAppState } from "../app/hooks";
import { fitNotesRequest, mergeNotesRequest, mergeSyllablesRequest, splitNoteRequest } from "../app/requests";

/** A one-tap fix for a line that doesn't sit on its phrase. */
interface MelodyFix {
  label: string;
  request: string;
  /** It changes the words, so a locked line doesn't get it. */
  changesWords: boolean;
}

export interface MelodySettingViewProps {
  section: Section;
  setting: MelodySetting;
  /** Sends a fix to Ode. */
  onAsk: (request: string) => void;
  onHide: () => void;
}

/** The section's lines set to the melody: one piano roll with the syllables under the notes, then how each line fits. */
export function MelodySettingView({ section, setting, onAsk, onHide }: MelodySettingViewProps) {
  const song = useAppState((state) => state.song);
  const busy = useAppState((state) => state.busy);
  const notes = setting.lines.flatMap((line) => line.notes);
  const marks = setting.lines.flatMap((line) => line.notes.map((_, index) => line.marks[index] ?? null));

  return (
    <div className="melody">
      <div className="melody__header">
        <p className="melody__clip">Set to {setting.clip}</p>
        <Button variant={ButtonVariant.Quiet} onClick={onHide}>
          Hide
        </Button>
      </div>
      <PianoRoll
        label={`Melody of ${section.name} with the syllables sung on each note`}
        notes={notes}
        lyrics={marks}
        lengthBeats={setting.lengthBeats}
        beatsPerBar={beatsPerBar(song)}
      />
      <ol className="melody__lines">
        {setting.lines.map((line, index) => (
          <MelodyLineFit
            key={`${index}-${line.line}`}
            section={section}
            line={line}
            number={lineNumber(section, line, index)}
            busy={busy}
            onAsk={onAsk}
          />
        ))}
      </ol>
    </div>
  );
}

interface MelodyLineFitProps {
  section: Section;
  line: MelodyLine;
  /** The line's number in the section, from 1. */
  number: number;
  busy: boolean;
  onAsk: (request: string) => void;
}

/** "syllables/notes", red when they differ, the first problem the check found, and the fixes. */
function MelodyLineFit({ section, line, number, busy, onAsk }: MelodyLineFitProps) {
  const locked = section.lines.find((candidate) => candidate.id === line.line)?.locked ?? false;
  const fixes = melodyFixes(section.name, number, line).filter((fix) => !locked || !fix.changesWords);
  const fits = line.syllables === line.noteCount;
  const problem = line.issues[0]?.problem;

  return (
    <li className="melody__line" title={line.text}>
      <p className="melody__fit">
        <span className="melody__number">
          Line {number}
          {locked && " · locked"}
        </span>
        <span className={cx("melody__count", !fits && "melody__count--off")} aria-hidden="true">
          {line.syllables}/{line.noteCount}
        </span>
        <span className="ode-visually-hidden">
          {line.syllables} syllables on {line.noteCount} notes
        </span>
      </p>
      {problem && <p className="melody__problem">{problem}</p>}
      {fixes.length > 0 && (
        <ChipGroup label={`Fixes for line ${number}`}>
          {fixes.map((fix) => (
            <Chip key={fix.label} title={fix.request} disabled={busy} onClick={() => onAsk(fix.request)}>
              {fix.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
    </li>
  );
}

/** More syllables than notes: split a note, merge two syllables or rewrite; fewer: merge two notes or rewrite. */
function melodyFixes(section: string, line: number, sung: MelodyLine): MelodyFix[] {
  const rewrite: MelodyFix = { label: "Rewrite the line", request: fitNotesRequest(section, line, sung.noteCount), changesWords: true };
  if (sung.syllables > sung.noteCount) {
    return [
      { label: "Split a note", request: splitNoteRequest(section, line), changesWords: false },
      { label: "Merge two syllables", request: mergeSyllablesRequest(section, line, sung.noteCount), changesWords: true },
      rewrite,
    ];
  }
  if (sung.syllables < sung.noteCount) {
    return [{ label: "Merge two notes", request: mergeNotesRequest(section, line), changesWords: false }, rewrite];
  }
  return sung.issues.length > 0 ? [rewrite] : [];
}

/** The line's place in the section as it is now; the setting's own order if the line has gone. */
function lineNumber(section: Section, line: MelodyLine, index: number): number {
  const position = section.lines.findIndex((candidate) => candidate.id === line.line);
  return position >= 0 ? position + 1 : index + 1;
}
