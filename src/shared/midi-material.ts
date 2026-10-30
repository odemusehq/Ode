import { z } from "zod";

/** Exact supported MIDI notes retained only for the request that produced or read them. */
export const MidiMaterialRefSchema = z.object({
  kind: z.literal("midi-material"),
  id: z.uuid(),
  count: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type MidiMaterialRef = z.infer<typeof MidiMaterialRefSchema>;
