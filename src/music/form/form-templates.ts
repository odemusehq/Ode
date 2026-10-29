import type { SectionKind } from "../../shared/song";
import { Genre } from "../rhythm/genre";

export interface SectionTemplate {
  kind: SectionKind;
  /** Length in phrases (a phrase is the planner's phrase length in bars). */
  phrases: number;
  /** Can be left out when the song runs long. */
  optional?: boolean;
  /** Name that overrides the section kind ("Hook", "A section"). */
  label?: string;
}

export interface FormTemplate {
  sections: SectionTemplate[];
  /** Typical song length for the genre, in minutes. */
  minutes: [number, number];
}

function section(kind: SectionKind, phrases: number, extra: Omit<SectionTemplate, "kind" | "phrases"> = {}): SectionTemplate {
  return { kind, phrases, ...extra };
}

const optional = { optional: true } as const;

const POP_FORM: FormTemplate = {
  sections: [
    section("intro", 1, optional),
    section("verse", 2),
    section("pre-chorus", 1, optional),
    section("chorus", 2),
    section("verse", 2),
    section("pre-chorus", 1, optional),
    section("chorus", 2),
    section("bridge", 2),
    section("chorus", 2),
    section("outro", 1, optional),
  ],
  minutes: [3, 3.75],
};

/** Typical forms per genre, 4/4. Club genres use long intros and outros for DJs. */
export const FORM_TEMPLATES: Readonly<Record<Genre, FormTemplate>> = {
  [Genre.Pop]: POP_FORM,
  [Genre.Rock]: {
    sections: [
      section("intro", 1, optional),
      section("verse", 2),
      section("chorus", 2),
      section("verse", 2),
      section("chorus", 2),
      section("bridge", 2),
      section("chorus", 2),
      section("outro", 1, optional),
    ],
    minutes: [3.25, 4.5],
  },
  [Genre.Ballad]: {
    sections: [
      section("intro", 1, optional),
      section("verse", 2),
      section("verse", 2, optional),
      section("chorus", 2),
      section("verse", 2),
      section("chorus", 2),
      section("bridge", 2),
      section("chorus", 2),
      section("outro", 1, optional),
    ],
    minutes: [3.5, 4.5],
  },
  [Genre.Funk]: {
    sections: [
      section("intro", 1),
      section("verse", 2),
      section("chorus", 2),
      section("verse", 2),
      section("chorus", 2),
      section("breakdown", 2),
      section("chorus", 2),
      section("outro", 2, optional),
    ],
    minutes: [3.5, 5],
  },
  [Genre.HipHop]: {
    sections: [
      section("intro", 1, optional),
      section("verse", 4),
      section("chorus", 2, { label: "Hook" }),
      section("verse", 4),
      section("chorus", 2, { label: "Hook" }),
      section("verse", 4, optional),
      section("chorus", 2, { label: "Hook" }),
      section("outro", 1, optional),
    ],
    minutes: [3, 4],
  },
  [Genre.Trap]: {
    sections: [
      section("intro", 1, optional),
      section("chorus", 2, { label: "Hook" }),
      section("verse", 4),
      section("chorus", 2, { label: "Hook" }),
      section("verse", 4, optional),
      section("chorus", 2, { label: "Hook" }),
      section("outro", 1, optional),
    ],
    minutes: [2.5, 3.5],
  },
  [Genre.RnB]: {
    sections: [
      section("intro", 1, optional),
      section("verse", 2),
      section("pre-chorus", 1),
      section("chorus", 2),
      section("verse", 2),
      section("pre-chorus", 1),
      section("chorus", 2),
      section("bridge", 2),
      section("chorus", 2),
      section("outro", 1, optional),
    ],
    minutes: [3, 4],
  },
  [Genre.LoFi]: {
    sections: [
      section("intro", 1),
      section("verse", 2, { label: "A section" }),
      section("chorus", 2, { label: "B section" }),
      section("verse", 2, { label: "A section" }),
      section("outro", 1),
    ],
    minutes: [2, 3],
  },
  [Genre.House]: {
    sections: [
      section("intro", 2),
      section("build", 1),
      section("drop", 2),
      section("breakdown", 2),
      section("build", 1),
      section("drop", 2),
      section("outro", 2),
    ],
    minutes: [5, 7],
  },
  [Genre.Techno]: {
    sections: [
      section("intro", 2),
      section("build", 1),
      section("drop", 4),
      section("breakdown", 2),
      section("build", 1),
      section("drop", 4),
      section("outro", 2),
    ],
    minutes: [5.5, 8],
  },
  [Genre.DrumAndBass]: {
    sections: [
      section("intro", 2),
      section("build", 1),
      section("drop", 2),
      section("breakdown", 2),
      section("build", 1),
      section("drop", 2),
      section("outro", 2),
    ],
    minutes: [4.5, 6.5],
  },
  [Genre.Reggaeton]: {
    sections: [
      section("intro", 1, optional),
      section("chorus", 2),
      section("verse", 2),
      section("pre-chorus", 1, optional),
      section("chorus", 2),
      section("verse", 2),
      section("chorus", 2),
      section("outro", 1, optional),
    ],
    minutes: [3, 3.75],
  },
  [Genre.Afrobeats]: {
    sections: [
      section("intro", 1, optional),
      section("verse", 2),
      section("chorus", 2),
      section("verse", 2),
      section("chorus", 2),
      section("bridge", 1, optional),
      section("chorus", 2),
      section("outro", 1, optional),
    ],
    minutes: [3, 3.75],
  },
};
