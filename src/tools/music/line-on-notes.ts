import { z } from "zod";
import { analyzeLine } from "../../music/phonetics/line-analyzer";
import type { PlannedSyllable } from "../../music/prosody/option-chooser";
import type { Note } from "../../shared/live";
import type { LineAnalysis } from "../../shared/lyrics";
import type { Accent } from "../../shared/personalisation";
import type { ToolContext } from "../define";
import { AccentInput, NotesInput, TimeSignatureInput } from "./schemas";
import { songDefaults, type TimeSignature } from "./song-defaults";

/** Inputs shared by the tools that look at one lyric line sung on notes. */
export const LINE_ON_NOTES_INPUT = {
  line: z.string().min(1).describe("One lyric line."),
  notes: NotesInput.min(1).describe("The melody notes for that line (as read from the MIDI clip); chords are reduced to their top note."),
  timeSignature: TimeSignatureInput.optional(),
  accent: AccentInput,
};

export interface LineOnNotes {
  accent: Accent;
  line: LineAnalysis;
  notes: Note[];
  signature: TimeSignature;
}

interface LineOnNotesRequest {
  line: string;
  notes: Note[];
  timeSignature?: TimeSignature;
  accent?: Accent;
}

export async function prepareLineOnNotes(ctx: ToolContext, input: LineOnNotesRequest): Promise<LineOnNotes> {
  if (input.accent && input.timeSignature) {
    return { accent: input.accent, line: analyzeLine(input.line, input.accent), notes: input.notes, signature: input.timeSignature };
  }
  const defaults = await songDefaults(ctx);
  const accent = input.accent ?? defaults.accent;
  return { accent, line: analyzeLine(input.line, accent), notes: input.notes, signature: input.timeSignature ?? defaults.timeSignature };
}

/** Syllables as shown to the musician: index, spelling, word and stress. */
export function describeSyllables(syllables: PlannedSyllable[]): { index: number; text: string; word: string; stress: number }[] {
  return syllables.map((syllable, index) => ({ index, text: syllable.text, word: syllable.wordText, stress: syllable.stress }));
}
