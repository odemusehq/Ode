import { z } from "zod";

const wellFormed = (value: string) => Array.from(value).every((character) => {
  const point = character.codePointAt(0)!;
  return point < 0xd800 || point > 0xdfff;
});

/** A download name, never a storage path or a request to change the audio format. */
export const AudioDeliveryNameSchema = z.string().trim().min(1).max(200)
  .refine((name) => !/[\\/\u0000-\u001f\u007f]/.test(name) && name !== "." && name !== ".." && wellFormed(name), "Use a valid filename without paths or control characters.");
const Hash = z.string().regex(/^[0-9a-f]{64}$/);
const Bytes = z.number().int().positive().max(128 * 1024 * 1024);
const Provenance = z.enum(["user-supplied", "sdk-pre-fx-capture"]);

/** Trusted local file identity rendered below a saved exchange; never an arbitrary URL. */
export const AudioDeliveryRefSchema = z.object({
  id: z.uuid(), songId: z.uuid(), name: AudioDeliveryNameSchema, sourceAudioId: z.uuid(),
  sha256: Hash, bytes: Bytes, createdAt: z.iso.datetime(), provenance: Provenance, currentness: z.literal("unknown"),
});
export type AudioDeliveryRef = z.infer<typeof AudioDeliveryRefSchema>;

export const AudioDeliveryManifestSchema = AudioDeliveryRefSchema.extend({
  version: z.literal(1),
  exchangeId: z.string().min(1).max(1000),
  extension: z.enum([".wav", ".wave", ".aif", ".aiff", ".aifc"]),
  source: z.object({
    id: z.uuid(), name: z.string().min(1).max(255), purpose: z.enum(["library", "reference", "processed-bounce"]),
    sha256: Hash, bytes: Bytes, provenance: Provenance, currentness: z.literal("unknown"),
    declaredSource: z.string().max(2000).optional(),
    range: z.object({ start: z.number().finite().min(0), end: z.number().finite().positive() }).optional(),
  }),
  audio: z.object({
    format: z.enum(["WAV", "AIFF"]), sampleRate: z.number().finite().positive(), channels: z.number().int().positive(),
    channelLayout: z.enum(["mono", "stereo", "unknown"]), frames: z.number().int().positive(),
    bitDepth: z.number().int().positive(), encoding: z.string().min(1).max(80), durationSeconds: z.number().finite().positive(),
  }),
}).superRefine((manifest, ctx) => {
  if (manifest.source.id !== manifest.sourceAudioId || manifest.source.sha256 !== manifest.sha256 || manifest.source.bytes !== manifest.bytes || manifest.source.provenance !== manifest.provenance) {
    ctx.addIssue({ code: "custom", message: "The retained file and captured source identity must match." });
  }
  if (manifest.audio.durationSeconds !== manifest.audio.frames / manifest.audio.sampleRate) ctx.addIssue({ code: "custom", message: "Duration must equal exact frames divided by sample rate." });
  const wavExtension = manifest.extension === ".wav" || manifest.extension === ".wave";
  if ((manifest.audio.format === "WAV") !== wavExtension) ctx.addIssue({ code: "custom", message: "The inspected audio container must match the retained extension." });
  if (!manifest.name.toLowerCase().endsWith(manifest.extension)) ctx.addIssue({ code: "custom", message: "The download name must preserve the supplied audio extension." });
});
export type AudioDeliveryManifest = z.infer<typeof AudioDeliveryManifestSchema>;
