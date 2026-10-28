import { z } from "zod";
import { ChordEventSchema } from "../../shared/song";

const MIDI_MAX = 127;
const PITCH_CLASS_MAX = 11;
const MAX_NUMERATOR = 32;
const DENOMINATORS = [1, 2, 4, 8, 16] as const;

export const AccentInput = z
  .enum(["uk", "us"])
  .optional()
  .describe('Pronunciation accent: "uk" or "us". Leave out to use the Pronunciation setting (song, then artist).');

export const NoteInput = z.object({
  pitch: z.number().int().min(0).max(MIDI_MAX).describe("MIDI note number (60 = middle C)."),
  start: z.number().min(0).describe("Start in beats (quarter notes) from the clip start."),
  duration: z.number().positive().describe("Length in beats."),
  velocity: z.number().min(0).max(MIDI_MAX).optional(),
  muted: z.boolean().optional(),
});

export const NotesInput = z.array(NoteInput);

export const ChordsInput = z
  .array(ChordEventSchema)
  .describe('Chord events: { beat (from the section start), lengthBeats, symbol such as "Am7", "F/C", "Bbsus2" }.');

export const RangeInput = z
  .object({
    low: z.number().int().min(0).max(MIDI_MAX).describe("Lowest MIDI note."),
    high: z.number().int().min(0).max(MIDI_MAX).describe("Highest MIDI note."),
  })
  .refine((range) => range.low <= range.high, "low must not be above high");

export const KeyInput = z
  .object({
    root: z.number().int().min(0).max(PITCH_CLASS_MAX).describe("Tonic pitch class: 0 = C, 1 = C#/Db … 11 = B."),
    scale: z.string().describe('Scale name as in Live: "Major", "Minor", "Dorian", "Mixolydian"…'),
  })
  .describe("Key of the song.");

export const TimeSignatureInput = z
  .object({
    numerator: z.number().int().min(1).max(MAX_NUMERATOR),
    denominator: z.literal(DENOMINATORS),
  })
  .describe("Time signature, e.g. { numerator: 6, denominator: 8 }. Leave out to use Live's.");

export const SeedInput = z.number().int().min(0).optional().describe("Same seed, same result; change it for a different take.");
