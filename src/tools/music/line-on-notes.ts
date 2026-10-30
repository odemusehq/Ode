import { z } from "zod";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import type { PlannedSyllable } from "../../music/prosody/option-chooser";
import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import type { Accent } from "../../shared/personalisation";
import type { ToolContext } from "../define";
import { AccentInput, NotesInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults, type TimeSignature } from "./song-defaults";

/** Clip-relative sung spans, shared by generation and fitting instead of guessing one whole-bar phrase per line. */
export const MelodyPhraseInput = z.object({
  line: z.number().int().min(1).describe("1-based place in the supplied sung lyric lines."),
  startBeat: z.number().min(0).describe("Phrase entrance in quarter-note beats from clip start; include pickups as nonnegative positions."),
  lengthBeats: z.number().positive().describe("Available sung span in quarter-note beats."),
  motifId: z.string().min(1).optional().describe("Reuse the first phrase's chosen motif across lines, scaling its timing to this span."),
  hookId: z.string().min(1).optional().describe("Use this retained hook's exact notes; no silent pitch, rhythm or articulation change."),
});

/** Inputs shared by the tools that look at one lyric line sung on notes. */
export const LINE_ON_NOTES_INPUT = {
  line: z.string().min(1).describe("One lyric line."),
  notes: NotesInput.min(1).describe("The melody notes for that line (as read from the MIDI clip); chords are reduced to their top note."),
  timeSignature: TimeSignatureInput.optional(),
  accent: AccentInput,
  tempo: z.number().positive().optional().describe("Tempo in BPM for physical-duration checks; defaults to the observed Set tempo."),
};

export interface LineOnNotes {
  accent: Accent;
  line: LineAnalysis;
  notes: Note[];
  signature: TimeSignature;
  tempo: number | null;
}

interface LineOnNotesRequest {
  line: string;
  notes: Note[];
  timeSignature?: TimeSignature;
  accent?: Accent;
  tempo?: number;
}

export async function prepareLineOnNotes(ctx: ToolContext, input: LineOnNotesRequest): Promise<LineOnNotes> {
  if (input.accent && input.timeSignature && input.tempo) {
    return { accent: input.accent, line: analyzeLine(input.line, input.accent), notes: input.notes, signature: input.timeSignature, tempo: input.tempo };
  }
  const defaults = await songDefaults(ctx);
  const accent = input.accent ?? defaults.accent;
  return { accent, line: analyzeLine(input.line, accent), notes: input.notes, signature: requireTimeSignature(input.timeSignature ?? defaults.timeSignature), tempo: input.tempo ?? defaults.tempo };
}

/** Preserve the chosen pronunciation and word boundaries as well as the display text. */
export function describeSyllables(syllables: PlannedSyllable[]) {
  return syllables.map((syllable, index) => ({ ...syllable, index, wordIndex: syllable.word, word: syllable.wordText }));
}
