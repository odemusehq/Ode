import { useEffect, useRef, useState } from "react";
import type { LineAnalysis, LyricsAnalysis, LyricsNote } from "../../shared/lyrics";
import type { Section } from "../../shared/song";
import { Badge, Button, ButtonVariant, IconName, Notice, Panel, Tone } from "../../ui-kit";
import { newId } from "../app/ids";
import { LyricLineEditor } from "./LyricLineEditor";
import { SECTION_KIND_LABELS } from "./section-kinds";
import type { LeadSheetLine } from "./useLyricsDrafts";

export interface SectionLyricsProps {
  section: Section;
  analysis: LyricsAnalysis | undefined;
  error: string | undefined;
  onChange: (lines: LeadSheetLine[]) => void;
}

/** The lyric lines of one section, each with its check results. */
export function SectionLyrics({ section, analysis, error, onChange }: SectionLyricsProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const { lines } = section;
  const fresh = isFresh(analysis, lines);

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

  return (
    <Panel title={section.name} actions={<Badge>{SECTION_KIND_LABELS[section.kind]}</Badge>}>
      {error && <Notice tone={Tone.Warning}>These lines couldn't be checked: {error}</Notice>}
      {lines.length === 0 ? (
        <p className="muted">No lines yet.</p>
      ) : (
        <ol className="lyrics__lines">
          {lines.map((line, index) => (
            <li key={line.id}>
              <LyricLineEditor
                line={line}
                label={`${section.name}, line ${index + 1}`}
                analysis={lineAnalysis(analysis, line, index)}
                rhyme={fresh ? analysis?.scheme[index] : undefined}
                notes={fresh ? notesFor(analysis, index) : []}
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
          ))}
        </ol>
      )}
      <div>
        <Button variant={ButtonVariant.Quiet} icon={IconName.Plus} onClick={() => insertAfter(lines.length - 1)}>
          Add line
        </Button>
      </div>
    </Panel>
  );
}

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function isFresh(analysis: LyricsAnalysis | undefined, lines: readonly LeadSheetLine[]): boolean {
  if (!analysis || analysis.lines.length !== lines.length) return false;
  return lines.every((line, index) => {
    const checked = analysis.lines[index];
    return checked !== undefined && sameText(checked.text, line.text);
  });
}

function lineAnalysis(analysis: LyricsAnalysis | undefined, line: LeadSheetLine, index: number): LineAnalysis | null {
  const checked = analysis?.lines[index];
  return checked && sameText(checked.text, line.text) ? checked : null;
}

function notesFor(analysis: LyricsAnalysis | undefined, index: number): LyricsNote[] {
  return analysis ? analysis.notes.filter((note) => note.line === index) : [];
}
