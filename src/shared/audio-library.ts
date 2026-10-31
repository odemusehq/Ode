import { z } from "zod";

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const finiteOrNull = z.number().finite().nullable();
export const LibraryKindSchema = z.enum(["one-shot", "loop", "recording"]);
export const LibraryProfileLevelSchema = z.literal("metadata");
export type LibraryProfileLevel = z.infer<typeof LibraryProfileLevelSchema>;

export const AudioProvenanceSchema = z.enum(["user-supplied", "sdk-pre-fx-capture", "max-device-capture", "local-excerpt"]);
const MaxCaptureSourceSchema = z.object({ id: boundedText(512), name: boundedText(512),
  kind: z.enum(["device", "track", "group", "return", "main"]),
  stage: z.enum(["device-input", "pre-fx", "post-fx", "post-mixer"]), trackName: boundedText(512).optional() });
/** Max routing and observed host timing retained with the captured bytes, never a claim of native export. */
export const MaxCaptureEvidenceSchema = z.object({
  capturedAt: z.string().datetime(),
  source: MaxCaptureSourceSchema,
  includedSources: z.array(MaxCaptureSourceSchema).min(1).max(64).readonly().optional(),
  host: z.object({ trackName: boundedText(512), deviceName: boundedText(512) }),
  timing: z.object({ startedBeat: finiteOrNull, endedBeat: finiteOrNull, prerollBeats: z.number().min(0).max(64),
    rangeUncertainty: boundedText(1000) }),
  requested: z.object({ sourceId: boundedText(512), durationSeconds: z.number().positive().max(300),
    startBeat: z.number().min(0).optional(), prerollBeats: z.number().min(0).max(64).optional(), includeSourceIds: z.array(boundedText(512)).min(1).max(64).readonly().optional() }),
  frames: z.number().int().positive().max(16_000_000), channels: z.literal(2),
  sampleRate: z.number().int().min(8000).max(384000), durationSeconds: z.number().positive(),
});
export type MaxCaptureEvidence = z.infer<typeof MaxCaptureEvidenceSchema>;
export const AudioExcerptFactsSchema = z.object({
  format: z.enum(["WAV", "AIFF"]), sampleRate: z.number().finite().positive(), channels: z.number().int().positive(),
  channelLayout: z.enum(["mono", "stereo", "unknown"]), frames: z.number().int().nonnegative(),
  bitDepth: z.number().int().positive(), encoding: boundedText(80),
});
export type AudioExcerptFacts = z.infer<typeof AudioExcerptFactsSchema>;

/** One parent reference, never copied recursive ancestry or a declaration of Arrangement beat positions. */
export const AudioExcerptDerivationSchema = z.object({
  kind: z.literal("local-excerpt"), version: z.literal(1),
  sourceAudioId: z.uuid(), sourceSha256: z.string().regex(/^[0-9a-f]{64}$/), sourceBytes: z.number().int().positive(),
  sourceProvenance: AudioProvenanceSchema, source: AudioExcerptFactsSchema,
  firstFrame: z.number().int().min(0), endFrame: z.number().int().positive(),
  output: AudioExcerptFactsSchema, container: z.enum(["WAV", "AIFF", "AIFC"]),
  exchangeId: z.string().min(1).max(1000),
}).superRefine((value, ctx) => {
  if (value.endFrame <= value.firstFrame || value.endFrame > value.source.frames || value.output.frames !== value.endFrame - value.firstFrame) {
    ctx.addIssue({ code: "custom", message: "The nonempty exclusive frame selection must fit the parent and match the output frame count." });
  }
  if (["format", "sampleRate", "channels", "channelLayout", "bitDepth", "encoding"].some((field) =>
    value.source[field as keyof AudioExcerptFacts] !== value.output[field as keyof AudioExcerptFacts])) {
    ctx.addIssue({ code: "custom", message: "A raw excerpt must preserve source format, sample rate, channels and sample encoding." });
  }
  if ((value.container === "WAV") !== (value.output.format === "WAV")) ctx.addIssue({ code: "custom", message: "The excerpt container must match its inspected format." });
});
export type AudioExcerptDerivation = z.infer<typeof AudioExcerptDerivationSchema>;

/** Declarations entered by Ode from the conversation, never a claim that audio analysis established them. */
export const LibraryAnnotationsPatchSchema = z.object({
  labels: z.array(boundedText(80)).max(32).optional(),
  role: boundedText(120).nullable().optional(),
  kind: LibraryKindSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  declaredBpm: z.number().finite().positive().max(1000).nullable().optional(),
  declaredKey: boundedText(80).nullable().optional(),
}).strict();
export type LibraryAnnotationsPatch = z.infer<typeof LibraryAnnotationsPatchSchema>;
export const LibraryAnnotationsSchema = LibraryAnnotationsPatchSchema.extend({
  revision: z.number().int().nonnegative(),
  enteredBy: z.literal("ode"),
  exchangeId: z.string().uuid().optional(),
  updatedAt: z.string().datetime(),
});
export type LibraryAnnotations = z.infer<typeof LibraryAnnotationsSchema>;

/** Whole-file readings bound to the captured original bytes; they do not establish current Set sound. */
export const LibraryProfileSchema = z.object({
  version: z.literal(1),
  method: z.literal("ode-audio-profile-v1"),
  measuredAt: z.string().datetime(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  level: z.enum(["metadata", "full"]),
  format: z.enum(["WAV", "AIFF"]),
  sampleRate: z.number().finite().positive(),
  channels: z.number().int().positive(),
  channelLayout: z.enum(["mono", "stereo", "unknown"]),
  frames: z.number().int().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  bitDepth: z.number().int().positive(),
  encoding: boundedText(80),
  sampleValues: z.enum(["unexamined", "validated-finite"]),
  measurements: z.object({
    integratedLufs: finiteOrNull,
    truePeakDbtp: finiteOrNull,
    samplePeakDbfs: finiteOrNull,
    tiltDbPerOctave: finiteOrNull,
    loudnessStatus: boundedText(300),
    coverage: boundedText(2000),
  }).optional(),
  report: z.record(z.string(), z.unknown()).optional(),
}).superRefine((profile, ctx) => {
  if (profile.durationSeconds !== profile.frames / profile.sampleRate) {
    ctx.addIssue({ code: "custom", message: "Duration must equal source frames divided by sample rate." });
  }
  if (profile.level === "full" && (!profile.measurements || profile.sampleValues !== "validated-finite" || profile.frames === 0)) {
    ctx.addIssue({ code: "custom", message: "A full profile needs finite-sample validation and measurements." });
  }
  if (profile.level === "metadata" && (profile.measurements || profile.report || profile.sampleValues !== "unexamined")) {
    ctx.addIssue({ code: "custom", message: "A metadata profile does not examine samples or measure levels." });
  }
});
export type LibraryProfile = z.infer<typeof LibraryProfileSchema>;

const bounds = z.object({ min: z.number().finite().optional(), max: z.number().finite().optional() })
  .refine(({ min, max }) => min === undefined || max === undefined || min <= max, "Minimum must not exceed maximum.");
export const LibrarySearchSchema = z.object({
  query: z.string().max(2000).optional(),
  purpose: z.enum(["library", "reference", "processed-bounce"]).optional(),
  labels: z.array(boundedText(80)).max(32).optional(),
  role: boundedText(120).optional(),
  kind: LibraryKindSchema.optional(),
  declaredBpm: bounds.optional(),
  declaredKey: boundedText(80).optional(),
  durationSeconds: bounds.optional(),
  channels: z.number().int().positive().optional(),
  profileDetail: LibraryProfileLevelSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(100000).optional(),
  expectedSelectionFingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();
export type LibrarySearch = z.infer<typeof LibrarySearchSchema>;
export interface LibrarySearchCoverage {
  catalogue: number;
  matchedDeclarations: number;
  profiled: number;
  unprofiled: number;
  excludedUnknown: number;
  unreadable: number;
}
