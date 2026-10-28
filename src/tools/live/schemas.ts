import { z } from "zod";
import { MIXER_INDEX } from "../../shared/live";

const index = z.number().int().min(0);

export const TrackRefSchema = z
  .union([
    z.object({ index }),
    z.object({ name: z.string().min(1) }),
    z.object({ tag: z.string().min(1) }),
    z.object({ main: z.literal(true) }),
    z.object({ returnIndex: index }),
  ])
  .describe("A track: {index} (0-based, regular tracks), {name}, {tag}, {main: true} for the Main track, or {returnIndex} (0-based).");

export const ClipSlotRefSchema = z
  .object({ track: TrackRefSchema, slot: index.describe("0-based clip slot (scene row) in Session View") })
  .describe("A Session View clip slot.");

export const ArrangementClipRefSchema = z
  .object({ track: TrackRefSchema, start: z.number().min(0).describe("Start of the clip in the Arrangement, in beats") })
  .describe("An Arrangement clip, found by its track and start beat.");

export const ClipRefSchema = z
  .union([ClipSlotRefSchema, ArrangementClipRefSchema, z.object({ tag: z.string().min(1) })])
  .describe("A clip: a Session clip slot {track, slot}, an Arrangement clip {track, start}, or a clip Ode created {tag}.");

export const TakeLaneRefSchema = z.object({ track: TrackRefSchema, lane: index.describe("0-based take lane") });

export const DeviceRefSchema = z
  .object({
    track: TrackRefSchema,
    chain: z
      .array(index)
      .optional()
      .describe("Path into racks as pairs, from the track inwards: [rack's device index, chain index, …]; leave out for devices directly on the track"),
    index: z
      .number()
      .int()
      .min(MIXER_INDEX)
      .describe(`0-based device position on the track or in the innermost chain; ${MIXER_INDEX} for the mixer (parameters: 0 volume, 1 pan, 2+ sends)`),
  })
  .describe("A device on a track or inside a rack chain, or the track's or chain's mixer.");

export const ParameterRefSchema = z.object({
  device: DeviceRefSchema,
  parameter: z.union([index, z.string().min(1)]).describe("Parameter index or exact name as shown in Live"),
});

export const SceneRefSchema = z.union([z.object({ index }), z.object({ name: z.string().min(1) })]).describe("A scene: {index} (0-based) or {name}.");

export const LocatorRefSchema = z
  .union([z.object({ index }), z.object({ name: z.string().min(1) }), z.object({ time: z.number().min(0) })])
  .describe("A locator: {index} (0-based), {name}, or {time} in beats.");

export const NoteSchema = z.object({
  pitch: z.number().int().min(0).max(127).describe("MIDI note number (60 = C3 in Live)"),
  start: z.number().min(0).describe("Beats from the clip start"),
  duration: z.number().positive().describe("Length in beats"),
  velocity: z.number().min(1).max(127).optional(),
  muted: z.boolean().optional(),
  probability: z.number().min(0).max(1).optional().describe("Chance the note plays, 0–1"),
  velocityDeviation: z.number().min(-127).max(127).optional().describe("Random velocity range"),
  releaseVelocity: z.number().min(0).max(127).optional(),
});

export const LoopSchema = z
  .object({
    looping: z.boolean(),
    startMarker: z.number(),
    endMarker: z.number(),
    loopStart: z.number(),
    loopEnd: z.number(),
  })
  .describe("Clip region and loop in beats. The loop must be at least a sixteenth note long; unwarped clips can't loop.");

export const nameFields = {
  name: z.string().min(1).optional().describe("Name shown in Live"),
  tag: z
    .string()
    .regex(/^[a-z0-9]{2,8}$/)
    .optional()
    .describe("Short tag Ode adds to the name so it can find this object again after it moves (record it in the lead sheet's links)"),
};
