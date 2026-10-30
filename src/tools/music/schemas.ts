import { z } from "zod";
import { MIDI_MAX } from "../../shared/notes";
import { ChordEventSchema } from "../../shared/song";
import { NoteSchema } from "../live/schemas";

/** The longest stretch the music tools write in one call, in bars. */
export const MAX_BARS = 64;
const PITCH_CLASS_MAX = 11;
const MAX_NUMERATOR = 32;
const DENOMINATORS = [1, 2, 4, 8, 16] as const;

export const AccentInput = z
  .enum(["uk", "us"])
  .optional()
  .describe('Pronunciation accent: "uk" or "us". Leave out to use the Pronunciation setting (song, then artist).');

/** A note as the Live tools read and write it, every field kept, so notes pass through the music tools whole. */
export const NoteInput = NoteSchema;

export const NotesInput = z.array(NoteInput);

export const ChordsInput = z
  .array(ChordEventSchema)
  .describe('Nonoverlapping chord events: { beat (from the section start), lengthBeats, symbol such as "Am7", "F/C", "Bbsus2" }. NC or N.C. explicitly means no chord accompaniment/constraint, not a silent lead melody. Unsupported symbols and repeat marks refuse rather than being guessed; use supported spellings or explicit MIDI voicings.');

export const RangeInput = z
  .object({
    low: z.number().int().min(0).max(MIDI_MAX).describe("Lowest MIDI note."),
    high: z.number().int().min(0).max(MIDI_MAX).describe("Highest MIDI note."),
  })
  .refine((range) => range.low <= range.high, "low must be at or below high");

export const KeyInput = z
  .object({
    root: z.number().int().min(0).max(PITCH_CLASS_MAX).describe("Tonic pitch class: 0 = C, 1 = C#/Db … 11 = B."),
    scale: z.string().describe('Scale name as in Live: "Major", "Minor", "Dorian", "Mixolydian"…'),
    intervals: z
      .array(z.number().int().min(0).max(PITCH_CLASS_MAX))
      .optional()
      .describe("The scale's steps above the tonic in semitones, as Live gives them (Harmonic Minor: 0 2 3 5 7 8 11); they set the scale's notes."),
  })
  .describe("Key of the song.");

export const TimeSignatureInput = z
  .object({
    numerator: z.number().int().min(1).max(MAX_NUMERATOR),
    denominator: z.literal(DENOMINATORS),
  })
  .describe("Time signature, e.g. { numerator: 6, denominator: 8 }. Leave out to use Live's.");

export const SeedInput = z.number().int().min(0).optional().describe("Same seed, same result; change it for a different take.");
