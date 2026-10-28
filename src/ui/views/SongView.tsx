import type { Intent, LeadSheet, Section } from "../../shared/song";
import { Badge, ChordChart, EmptyState, Panel } from "../../ui-kit";
import { barAt, beatsPerBar, formatKey, formatTempo, formatTimeSignature } from "../app/format";
import { useAppState } from "../app/hooks";
import { Fact } from "./Fact";
import { SECTION_KIND_LABELS } from "./section-kinds";
import "./views.css";

const INTENT_LABELS: Record<keyof Intent, string> = {
  theme: "Theme",
  story: "Story",
  pointOfView: "Point of view",
  mood: "Mood",
  hook: "Hook",
};

const INTENT_ORDER: readonly (keyof Intent)[] = ["theme", "story", "pointOfView", "mood", "hook"];

export function SongView() {
  const song = useAppState((state) => state.song);

  if (!song) {
    return (
      <div className="view">
        <EmptyState title="No song open">The lead sheet appears here once Ode can read the Live Set.</EmptyState>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">{song.title || "Untitled song"}</h2>
      <SongFacts song={song} />
      <IntentPanel intent={song.intent} />
      <SectionsPanel song={song} />
    </div>
  );
}

interface SongProps {
  song: LeadSheet;
}

function SongFacts({ song }: SongProps) {
  return (
    <dl className="facts">
      <Fact label="Tempo" value={formatTempo(song.tempo)} />
      <Fact label="Key" value={formatKey(song.key)} />
      <Fact label="Time signature" value={formatTimeSignature(song.timeSignature)} />
      <Fact label="Sections" value={String(song.sections.length)} />
    </dl>
  );
}

interface IntentPanelProps {
  intent: Intent;
}

function IntentPanel({ intent }: IntentPanelProps) {
  const filled = INTENT_ORDER.filter((key) => intent[key]);
  return (
    <Panel title="What the song is about">
      {filled.length === 0 ? (
        <p className="muted">Nothing yet. Tell Ode the theme, story, point of view, mood or hook.</p>
      ) : (
        <dl className="facts">
          {filled.map((key) => (
            <Fact key={key} label={INTENT_LABELS[key]} value={intent[key] ?? ""} />
          ))}
        </dl>
      )}
    </Panel>
  );
}

/** The song's form: each section in order with where it sits and its chord chart. */
function SectionsPanel({ song }: SongProps) {
  const perBar = beatsPerBar(song);
  if (song.sections.length === 0) {
    return (
      <Panel title="Sections">
        <p className="muted">No sections yet. Ask Ode to plan the song form, or add sections in the Lyrics tab.</p>
      </Panel>
    );
  }
  return (
    <>
      {song.sections.map((section) => (
        <SectionPanel key={section.id} section={section} perBar={perBar} />
      ))}
    </>
  );
}

interface SectionPanelProps {
  section: Section;
  perBar: number;
}

function SectionPanel({ section, perBar }: SectionPanelProps) {
  const firstBar = barAt(section.startBeat, perBar);
  const bars = Math.round(section.lengthBeats / perBar);
  return (
    <Panel title={section.name} actions={<Badge>{SECTION_KIND_LABELS[section.kind]}</Badge>}>
      <p className="muted small">
        Bar {firstBar}, {bars} bars · {section.lines.length} lines · {section.chords.length} chords
      </p>
      {section.chords.length === 0 ? (
        <p className="muted">No chords in this section yet.</p>
      ) : (
        <ChordChart label={`Chord chart of ${section.name}`} chords={section.chords} lengthBeats={section.lengthBeats} beatsPerBar={perBar} />
      )}
    </Panel>
  );
}
