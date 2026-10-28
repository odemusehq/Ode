import { useEffect, useRef, useState } from "react";
import type { LineAnalysis, LyricsAnalysis, LyricsNote, MelodySetting } from "../../shared/lyrics";
import type { Section } from "../../shared/song";
import { Badge, Button, ButtonVariant, IconName, Notice, Panel, Tone } from "../../ui-kit";
import { newId } from "../app/ids";
import { LyricLineEditor } from "./LyricLineEditor";
import { isFresh, lineFits, sameText } from "./lyric-targets";
import { MelodySettingView } from "./MelodySettingView";
import { SECTION_KIND_LABELS } from "./section-kinds";
import type { LeadSheetLine } from "./useLyricsDrafts";

export interface SectionLyricsProps {
  section: Section;
  analysis: LyricsAnalysis | undefined;
  error: string | undefined;
  /** The first section of the same kind, whose lines this one should match, and its check. */
  reference?: Section;
  referenceAnalysis?: LyricsAnalysis;
  /** The section's lines set to the melody, while it shows; the line counts are then checked against its notes. */
  melody?: MelodySetting;
  readingMelody: boolean;
  onChange: (lines: LeadSheetLine[]) => void;
  onSetToMelody: () => void;
  onHideMelody: () => void;
  /** Sends a request to Ode, such as rewriting a line to fit. */
  onAsk: (request: string) => void;
}

/** The lyric lines of one section, each with its check results, and the section set to the melody when asked. */
export function SectionLyrics({
  section,
  analysis,
  error,
  reference,
  referenceAnalysis,
  melody,
  readingMelody,
  onChange,
  onSetToMelody,
  onHideMelody,
  onAsk,
}: SectionLyricsProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const { lines } = section;
  const fresh = isFresh(analysis, lines);
  const fits = lineFits(section, melody, reference, referenceAnalysis);

  useEffect(() => {
    if (!focusLineId) return;
    inputs.current.get(focusLineId)?.focus();
    setFocusLineId(null);
  }, [focusLineId, lines]);

  const updateLine = (index: number, patch: Partial<LeadSheetLine>) => {
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  };

  const insertAfter = (index: number) => {
    const line: LeadSheetLine = { id: newId(), text: "" };
    onChange([...lines.slice(0, index + 1), line, ...lines.slice(index + 1)]);
    setFocusLineId(line.id);
  };

  const remove = (index: number) => {
    const previous = lines[index - 1] ?? lines[index + 1];
    onChange(lines.filter((_, position) => position !== index));
    if (previous) setFocusLineId(previous.id);
  };

  const move = (index: number, step: number) => {
    const target = lines[index + step];
    if (target) inputs.current.get(target.id)?.focus();
  };

  const actions = (
    <>
      <Button
        variant={ButtonVariant.Quiet}
        disabled={readingMelody}
        title="Put these lines under the notes of the clip selected in Live"
        onClick={onSetToMelody}
      >
        Set to melody
      </Button>
      <Badge>{SECTION_KIND_LABELS[section.kind]}</Badge>
    </>
  );

  return (
    <Panel title={section.name} actions={actions}>
      {error && <Notice tone={Tone.Warning}>These lines couldn't be checked: {error}</Notice>}
      {lines.length === 0 ? (
        <p className="muted">No lines yet.</p>
      ) : (
        <ol className="lyrics__lines">
          {lines.map((line, index) => {
            const fit = fits[index];
            return (
              <li key={line.id}>
                <LyricLineEditor
                  line={line}
                  label={`${section.name}, line ${index + 1}`}
                  analysis={lineAnalysis(analysis, line, index)}
                  rhyme={fresh ? analysis?.scheme[index] : undefined}
                  notes={fresh ? notesFor(analysis, index) : []}
                  target={fit?.target}
                  onFit={fit && !line.locked ? () => onAsk(fit.request) : undefined}
                  inputRef={(element) => {
                    if (element) inputs.current.set(line.id, element);
                    else inputs.current.delete(line.id);
                  }}
                  onTextChange={(text) => updateLine(index, { text })}
                  onLockChange={(locked) => updateLine(index, { locked })}
                  onEnter={() => insertAfter(index)}
                  onRemove={() => remove(index)}
                  onMove={(step) => move(index, step)}
                />
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <Button variant={ButtonVariant.Quiet} icon={IconName.Plus} onClick={() => insertAfter(lines.length - 1)}>
          Add line
        </Button>
      </div>
      {readingMelody && !melody && <p className="muted small">Reading the melody…</p>}
      {melody && <MelodySettingView section={section} setting={melody} onAsk={onAsk} onHide={onHideMelody} />}
    </Panel>
  );
}

function lineAnalysis(analysis: LyricsAnalysis | undefined, line: LeadSheetLine, index: number): LineAnalysis | null {
  const checked = analysis?.lines[index];
  return checked && sameText(checked.text, line.text) ? checked : null;
}

function notesFor(analysis: LyricsAnalysis | undefined, index: number): LyricsNote[] {
  return analysis ? analysis.notes.filter((note) => note.line === index) : [];
}
