import type { Section, SectionKind } from "../../shared/song";
import type { Genre } from "../rhythm/genre";
import { FORM_TEMPLATES, type SectionTemplate } from "./form-templates";

const DEFAULT_BEATS_PER_BAR = 4;
const SECONDS_PER_MINUTE = 60;
/** At most this many phrases are added to reach a genre's usual length. */
const MAX_EXTENSIONS = 6;

const SECTION_NAMES: Readonly<Record<SectionKind, string>> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-Chorus",
  chorus: "Chorus",
  "post-chorus": "Post-Chorus",
  bridge: "Bridge",
  breakdown: "Breakdown",
  build: "Build",
  drop: "Drop",
  outro: "Outro",
  other: "Section",
};

export interface SongFormPlan {
  sections: Section[];
  totalBars: number;
  seconds: number;
}

/**
 * Plans a song form for a genre: the genre's typical sections, trimmed or extended so the song
 * lasts about as long as songs in that genre at the given tempo, with start beats and lengths.
 */
export class SongFormPlanner {
  plan(genre: Genre, tempo: number, phraseBars: number, beatsPerBar = DEFAULT_BEATS_PER_BAR): SongFormPlan {
    const template = FORM_TEMPLATES[genre];
    const beatsPerPhrase = Math.max(1, phraseBars) * beatsPerBar;
    const sections = template.sections.map((item) => ({ ...item }));
    const [shortest, longest] = template.minutes;
    while (this.minutes(sections, beatsPerPhrase, tempo) > longest) {
      const index = sections.map((item) => item.optional === true).lastIndexOf(true);
      if (index < 0) break;
      sections.splice(index, 1);
    }
    for (let extension = 0; extension < MAX_EXTENSIONS && this.minutes(sections, beatsPerPhrase, tempo) < shortest; extension++) {
      this.extend(sections, extension);
    }
    const built = this.build(sections, beatsPerPhrase);
    const totalBeats = built.reduce((sum, item) => sum + item.lengthBeats, 0);
    return { sections: built, totalBars: totalBeats / beatsPerBar, seconds: Math.round((totalBeats / Math.max(1, tempo)) * SECONDS_PER_MINUTE) };
  }

  private minutes(sections: SectionTemplate[], beatsPerPhrase: number, tempo: number): number {
    return (sections.reduce((sum, item) => sum + item.phrases, 0) * beatsPerPhrase) / Math.max(1, tempo);
  }

  /** First repeat the last chorus (or drop), then lengthen the intro and outro by a phrase. */
  private extend(sections: SectionTemplate[], step: number): void {
    const climax = sections.map((item) => item.kind === "chorus" || item.kind === "drop").lastIndexOf(true);
    const climaxSection = sections[climax];
    if (step === 0 && climaxSection) {
      sections.splice(climax + 1, 0, { ...climaxSection, optional: true });
      return;
    }
    const target = sections.find((item) => item.kind === (step % 2 === 1 ? "outro" : "intro")) ?? sections.at(-1);
    if (target) target.phrases += 1;
  }

  private build(templates: SectionTemplate[], beatsPerPhrase: number): Section[] {
    const totals = new Map<string, number>();
    for (const item of templates) totals.set(this.baseName(item), (totals.get(this.baseName(item)) ?? 0) + 1);
    const counters = new Map<string, number>();
    const kindCounters = new Map<SectionKind, number>();
    let startBeat = 0;
    return templates.map((item) => {
      const base = this.baseName(item);
      const number = (counters.get(base) ?? 0) + 1;
      counters.set(base, number);
      const kindNumber = (kindCounters.get(item.kind) ?? 0) + 1;
      kindCounters.set(item.kind, kindNumber);
      const lengthBeats = item.phrases * beatsPerPhrase;
      const section: Section = {
        id: `${item.kind}-${kindNumber}`,
        kind: item.kind,
        name: (totals.get(base) ?? 0) > 1 ? `${base} ${number}` : base,
        startBeat,
        lengthBeats,
        chords: [],
      };
      startBeat += lengthBeats;
      return section;
    });
  }

  private baseName(item: SectionTemplate): string {
    return item.label ?? SECTION_NAMES[item.kind];
  }
}
