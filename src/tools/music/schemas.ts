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
    scale: z.string().describe('Recognised scale name or alias, such as "Major", "Natural Minor", "Harmonic Minor", "Whole Tone" or "Minor Pentatonic". Unknown names require explicit intervals; no parent scale is guessed.'),
    intervals: z
      .array(z.number().int().min(0).max(PITCH_CLASS_MAX))
      .optional()
      .describe("Authoritative nonempty, unique integer semitone offsets 0–11 above the root, as Live provides them (Harmonic Minor: 0 2 3 5 7 8 11). They override the name, may describe any custom pitch set, and need not contain 0 or seven notes. The returned scale label remains declared; the intervals determine the actual notes. Input order is retained in the specification; scale-degree operations use ascending relative offsets."),
  })
  .describe("The song's named scale or explicit pitch set. Melody and note checks use the actual intervals. Automatic functional harmonization supports only an actual pitch set matching one of the seven diatonic modes; use an explicit chord chart or MIDI for other harmonic choices.");

export const TimeSignatureInput = z
  .object({
    numerator: z.number().int().min(1).max(MAX_NUMERATOR),
    denominator: z.literal(DENOMINATORS),
  })
  .describe("Time signature, e.g. { numerator: 6, denominator: 8 }. Leave out to use Live's.");

export const SeedInput = z.number().int().min(0).optional().describe("Same seed, same result; change it for a different take.");
