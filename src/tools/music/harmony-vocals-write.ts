import { z } from "zod";
import { MusicalKey } from "../../music/harmony/musical-key";
import { Meter } from "../../music/prosody/meter";
import { harmonyLines } from "../../music/vocals/harmony-lines";
import { defineTool } from "../define";
import { ChordsInput, NotesInput, RangeInput, TimeSignatureInput } from "./schemas";
import { requireTimeSignature, songDefaults } from "./song-defaults";

const MAX_PARTS = 3;
const PART_NAMES = ["third above", "third or sixth below", "lower chord tone"];

export const harmonyVocalsWriteTool = defineTool({
  name: "harmony_vocals_write",
  description: [
    "Writes harmony (backing-vocal) lines for a lead melody as MIDI notes the singer can follow: part 1 a third above,",
    "part 2 a third or sixth below, part 3 a lower chord tone, all inside the chord where possible, in the same rhythm",
    "as the lead, without parallel octaves or fifths against the lead, without crossing, and inside the singers' range.",
    "Use it for harmonies and stacks in choruses; put each part on its own track or clip.",
    "Inputs: melody (the lead notes); chords (events from beat 0); parts (1–3); range (optional MIDI low/high,",
    "defaults to the artist's vocal range, else close around the lead).",
    "Returns { parts }: one entry per part with name and notes.",
  ].join(" "),
  input: {
    melody: NotesInput.min(1).describe("The lead vocal melody."),
    chords: ChordsInput,
    parts: z.number().int().min(1).max(MAX_PARTS).describe("How many harmony parts."),
    range: RangeInput.optional(),
    timeSignature: TimeSignatureInput.optional(),
  },
  changes: "none",
  async run({ melody, chords, parts, range, timeSignature }, ctx) {
    const defaults = await songDefaults(ctx);
    const limits = range ?? defaults.vocalRange ?? undefined;
    const signature = requireTimeSignature(timeSignature ?? defaults.timeSignature);
    const meter = new Meter(signature.numerator, signature.denominator);
    const key = defaults.key ? MusicalKey.from(defaults.key) : undefined;
    const lines = harmonyLines(melody, chords, parts, limits, meter, key);
    return { parts: lines.map((notes, index) => ({ name: PART_NAMES[index] ?? `part ${index + 1}`, notes })) };
  },
});
