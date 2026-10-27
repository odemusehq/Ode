import type { SectionKind } from "../../shared/song";

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-chorus",
  chorus: "Chorus",
  "post-chorus": "Post-chorus",
  bridge: "Bridge",
  breakdown: "Breakdown",
  build: "Build",
  drop: "Drop",
  outro: "Outro",
  other: "Other",
};

export const SECTION_KINDS = Object.keys(SECTION_KIND_LABELS) as SectionKind[];
