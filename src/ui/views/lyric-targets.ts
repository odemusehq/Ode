import type { LyricsAnalysis, MelodySetting } from "../../shared/lyrics";
import type { Section, SectionKind } from "../../shared/song";
import { formatSyllableCounts } from "../../ui-kit";
import type { SyllableTarget } from "../../ui-kit";
import { fitLineRequest, fitNotesRequest } from "../app/requests";
import type { LeadSheetLine } from "./useLyricsDrafts";

/** A line's syllable target, and what Ode is asked when its red count is tapped. */
export interface LineFit {
  target: SyllableTarget;
  request: string;
}

/** Sections sung to the same melody each time they come back, so a later one matches the first line for line. */
const REPEATING_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>(["verse", "pre-chorus", "chorus", "post-chorus", "bridge"]);

/** For each later section of a repeating kind, the first section of that kind: its lines set the syllable counts. */
export function referenceSections(sections: readonly Section[]): ReadonlyMap<string, Section> {
  const firsts = new Map<SectionKind, Section>();
  const references = new Map<string, Section>();
  for (const section of sections) {
    if (!REPEATING_KINDS.has(section.kind)) continue;
    const first = firsts.get(section.kind);
    if (first) references.set(section.id, first);
    else firsts.set(section.kind, section);
  }
  return references;
}

/**
 * Each line's target. With the section set to the melody, a line has to fit the notes of its phrase;
 * without, it has to match the same line of the first section of its kind, once that one's check is current.
 */
export function lineFits(
  section: Section,
  melody: MelodySetting | undefined,
  reference: Section | undefined,
  referenceAnalysis: LyricsAnalysis | undefined,
): readonly (LineFit | undefined)[] {
  return melody ? melodyFits(section, melody) : referenceFits(section, reference, referenceAnalysis);
}

/** The analysis was made from exactly these lines. */
export function isFresh(analysis: LyricsAnalysis | undefined, lines: readonly LeadSheetLine[]): boolean {
  if (!analysis || analysis.lines.length !== lines.length) return false;
  return lines.every((line, index) => {
    const checked = analysis.lines[index];
    return checked !== undefined && sameText(checked.text, line.text);
  });
}

export function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function melodyFits(section: Section, melody: MelodySetting): (LineFit | undefined)[] {
  return section.lines.map((line, index) => {
    const sung = melody.lines.find((candidate) => candidate.line === line.id);
    if (!sung) return undefined;
    return {
      target: { counts: [sung.noteCount], reason: `The melody has ${sung.noteCount} notes for this line` },
      request: fitNotesRequest(section.name, index + 1, sung.noteCount),
    };
  });
}

function referenceFits(section: Section, reference: Section | undefined, analysis: LyricsAnalysis | undefined): (LineFit | undefined)[] {
  if (!reference || !analysis || !isFresh(analysis, reference.lines)) return [];
  return section.lines.map((_, index) => {
    const matching = analysis.lines[index];
    if (!matching || matching.words.length === 0) return undefined;
    return {
      target: {
        counts: matching.counts,
        reason: `${reference.name}, line ${index + 1} has ${formatSyllableCounts(matching.counts)} syllables`,
      },
      request: fitLineRequest(section.name, index + 1, matching.counts),
    };
  });
}
