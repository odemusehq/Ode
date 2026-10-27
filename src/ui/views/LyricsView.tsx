import { useState } from "react";
import type { SectionKind } from "../../shared/song";
import { Badge, Button, EmptyState, IconName, Notice, Select, STRESS_MARKS, Tone } from "../../ui-kit";
import { useAppState } from "../app/hooks";
import { SECTION_KIND_LABELS, SECTION_KINDS } from "./section-kinds";
import { SectionLyrics } from "./SectionLyrics";
import { useLyricsAnalysis } from "./useLyricsAnalysis";
import { SaveState, useLyricsDrafts } from "./useLyricsDrafts";
import "./LyricsView.css";
import "./views.css";

const SAVE_LABELS: Record<SaveState, string> = {
  [SaveState.Saved]: "Saved",
  [SaveState.Waiting]: "Not saved yet",
  [SaveState.Saving]: "Saving…",
  [SaveState.Failed]: "Not saved",
};

const SAVE_TONES: Record<SaveState, Tone> = {
  [SaveState.Saved]: Tone.Success,
  [SaveState.Waiting]: Tone.Neutral,
  [SaveState.Saving]: Tone.Neutral,
  [SaveState.Failed]: Tone.Danger,
};

const KIND_OPTIONS = SECTION_KINDS.map((kind) => ({ value: kind, label: SECTION_KIND_LABELS[kind] }));

export function LyricsView() {
  const song = useAppState((state) => state.song);
  const { sections, updateLines, addSection, saveState, saveError } = useLyricsDrafts(song);
  const checks = useLyricsAnalysis(sections);

  if (!song) {
    return (
      <div className="view">
        <EmptyState title="No song open">The lyric editor appears once Ode can read the lead sheet.</EmptyState>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-toolbar">
        <p className="view-toolbar__text small">
          Stress: {STRESS_MARKS[1]} stressed, {STRESS_MARKS[2]} secondary, {STRESS_MARKS[0]} unstressed. Lock a line to keep
          Ode from changing it.
        </p>
        <Badge tone={SAVE_TONES[saveState]}>{SAVE_LABELS[saveState]}</Badge>
      </div>
      {saveError && <Notice tone={Tone.Danger}>Your lyrics weren't saved: {saveError}</Notice>}
      {sections.length === 0 && <EmptyState title="No sections yet">Add a section below to start writing.</EmptyState>}
      {sections.map((section) => (
        <SectionLyrics
          key={section.id}
          section={section}
          analysis={checks.analyses[section.id]}
          error={checks.errors[section.id]}
          onChange={(lines) => updateLines(section.id, lines)}
        />
      ))}
      <AddSectionForm onAdd={addSection} />
    </div>
  );
}

interface AddSectionFormProps {
  onAdd: (kind: SectionKind) => void;
}

function AddSectionForm({ onAdd }: AddSectionFormProps) {
  const [kind, setKind] = useState<SectionKind>("verse");
  return (
    <div className="form-row">
      <Select label="New section" value={kind} options={KIND_OPTIONS} onChange={setKind} />
      <Button icon={IconName.Plus} onClick={() => onAdd(kind)}>
        Add section
      </Button>
    </div>
  );
}
