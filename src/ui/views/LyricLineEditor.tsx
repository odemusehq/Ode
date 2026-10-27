import type { KeyboardEvent, Ref } from "react";
import type { LineAnalysis, LyricsNote } from "../../shared/lyrics";
import { IconButton, IconName, LyricLine, TextInput } from "../../ui-kit";
import type { LeadSheetLine } from "./useLyricsDrafts";

export interface LyricLineEditorProps {
  line: LeadSheetLine;
  /** Accessible name of the text box, e.g. "Verse 1, line 3". */
  label: string;
  analysis: LineAnalysis | null;
  rhyme?: string;
  notes: readonly LyricsNote[];
  inputRef: Ref<HTMLInputElement>;
  onTextChange: (text: string) => void;
  onLockChange: (locked: boolean) => void;
  /** Enter: start a new line after this one. */
  onEnter: () => void;
  onRemove: () => void;
  /** Arrow up or down: move to the line above (-1) or below (1). */
  onMove: (step: number) => void;
}

export function LyricLineEditor({
  line,
  label,
  analysis,
  rhyme,
  notes,
  inputRef,
  onTextChange,
  onLockChange,
  onEnter,
  onRemove,
  onMove,
}: LyricLineEditorProps) {
  const locked = line.locked ?? false;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") onEnter();
    else if (event.key === "Backspace" && line.text === "" && !locked) onRemove();
    else if (event.key === "ArrowUp") onMove(-1);
    else if (event.key === "ArrowDown") onMove(1);
    else return;
    event.preventDefault();
  };

  const actions = (
    <>
      <IconButton
        icon={locked ? IconName.Lock : IconName.Unlock}
        label="Lock line"
        pressed={locked}
        onClick={() => onLockChange(!locked)}
      />
      <IconButton icon={IconName.Trash} label="Remove line" disabled={locked} onClick={onRemove} />
    </>
  );

  return (
    <LyricLine analysis={analysis} rhyme={rhyme} notes={notes} actions={actions}>
      <TextInput
        ref={inputRef}
        value={line.text}
        readOnly={locked}
        aria-label={label}
        placeholder="Write a line…"
        title={locked ? "Locked: Ode won't change this line. Unlock it to edit." : undefined}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LyricLine>
  );
}
