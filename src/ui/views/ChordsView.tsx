import { Badge, ChordChart, EmptyState, Panel } from "../../ui-kit";
import { beatsPerBar } from "../app/format";
import { useAppState } from "../app/hooks";
import { SECTION_KIND_LABELS } from "./section-kinds";
import "./views.css";

export function ChordsView() {
  const song = useAppState((state) => state.song);

  if (!song || song.sections.length === 0) {
    return (
      <div className="view">
        <EmptyState title="No chord chart yet">
          Ask Ode for a chord progression, or to write the chords of a section.
        </EmptyState>
      </div>
    );
  }

  const perBar = beatsPerBar(song);
  return (
    <div className="view">
      {song.sections.map((section) => (
        <Panel key={section.id} title={section.name} actions={<Badge>{SECTION_KIND_LABELS[section.kind]}</Badge>}>
          {section.chords.length === 0 ? (
            <p className="muted">No chords in this section yet.</p>
          ) : (
            <ChordChart
              label={`Chord chart of ${section.name}`}
              chords={section.chords}
              lengthBeats={section.lengthBeats}
              beatsPerBar={perBar}
            />
          )}
        </Panel>
      ))}
    </div>
  );
}
