import { useMemo, useState } from "react";
import type { SectionKind } from "../../shared/song";
import { Badge, Button, EmptyState, IconName, Notice, Select, STRESS_MARKS, Tone } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import { referenceSections } from "./lyric-targets";
import { SECTION_KIND_LABELS, SECTION_KINDS } from "./section-kinds";
import { SectionLyrics } from "./SectionLyrics";
import { useLyricsAnalysis } from "./useLyricsAnalysis";
import { SaveState, useLyricsDrafts } from "./useLyricsDrafts";
import { useMelodySettings } from "./useMelodySettings";
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
  const client = useClient();
  const song = useAppState((state) => state.song);
  const { sections, updateLines, addSection, flush, saveState, saveError } = useLyricsDrafts(song);
  const checks = useLyricsAnalysis(sections);
  const references = useMemo(() => referenceSections(sections), [sections]);
  const melody = useMelodySettings();

  /** Ode works on the saved lead sheet, so waiting edits are saved first. */
  const ask = (request: string) => {
    flush();
    void client.send(request);
  };

  const setToMelody = (sectionId: string) => {
    flush();
    melody.show(sectionId);
  };

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
          Stress: {STRESS_MARKS[1]} stressed, {STRESS_MARKS[2]} secondary, {STRESS_MARKS[0]} unstressed. A count in red doesn't
          fit: the notes of the melody once a section is set to it, otherwise the same line of the first verse or chorus. Tap it
          and Ode rewrites the line. Lock a line to keep Ode from changing it.
        </p>
        <Badge tone={SAVE_TONES[saveState]}>{SAVE_LABELS[saveState]}</Badge>
      </div>
      {saveError && <Notice tone={Tone.Danger}>Your lyrics weren't saved: {saveError}</Notice>}
      {sections.length === 0 && <EmptyState title="No sections yet">Add a section below to start writing.</EmptyState>}
      {sections.map((section) => {
        const reference = references.get(section.id);
        return (
          <SectionLyrics
            key={section.id}
            section={section}
            analysis={checks.analyses[section.id]}
            error={checks.errors[section.id]}
            reference={reference}
            referenceAnalysis={reference ? checks.analyses[reference.id] : undefined}
            melody={melody.settings[section.id]}
            readingMelody={melody.reading.has(section.id)}
            onChange={(lines) => updateLines(section.id, lines)}
            onSetToMelody={() => setToMelody(section.id)}
            onHideMelody={() => melody.hide(section.id)}
            onAsk={ask}
          />
        );
      })}
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
