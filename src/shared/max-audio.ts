/** Bounded PCM capture through the paired Max device; no message carries a file path. */
export const MAX_AUDIO = {
  version: 3,
  messagePath: "/max-audio/message",
  maxBodyBytes: 128 * 1024,
  maxDurationSeconds: 300,
  maxFrames: 16_000_000,
  chunkFrames: 512,
  pcmChunkFrames: 2048,
  maxSources: 512,
} as const;

export interface MaxAudioSource {
  readonly id: string;
  readonly name: string;
  readonly kind: "device" | "track" | "group" | "return" | "main";
  readonly stage: "device-input" | "pre-fx" | "post-fx" | "post-mixer";
  readonly trackName?: string;
}

export interface MaxAudioHost { readonly trackName: string; readonly deviceName: string }
export interface MaxAudioSources {
  readonly catalogueId: string;
  readonly sources: readonly MaxAudioSource[];
  readonly host: MaxAudioHost;
}
export interface MaxAudioTiming {
  readonly startedBeat: number | null;
  readonly endedBeat: number | null;
  readonly prerollBeats: number;
  readonly rangeUncertainty: string;
}
export interface MaxAudioRequest {
  readonly sourceId: string;
  readonly durationSeconds: number;
  readonly startBeat?: number;
  readonly prerollBeats?: number;
  readonly includeSourceIds?: readonly string[];
}
export interface MaxAudioResult {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly frames: number;
  readonly channels: 2;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly source: MaxAudioSource;
  readonly includedSources?: readonly MaxAudioSource[];
  readonly host: MaxAudioHost;
  readonly timing: MaxAudioTiming;
  readonly requested: MaxAudioRequest;
}

export type MaxAudioCommand =
  | { readonly kind: "sources"; readonly id: string }
  | ({ readonly kind: "capture"; readonly id: string; readonly catalogueId: string } & MaxAudioRequest)
  | { readonly kind: "cancel"; readonly id: string };

export type MaxAudioMessage =
  | ({ readonly kind: "sources"; readonly id: string } & MaxAudioSources)
  | { readonly kind: "cancelled"; readonly id: string; readonly restored: boolean }
  | { readonly kind: "begin"; readonly id: string; readonly catalogueId: string; readonly sourceId: string; readonly sampleRate: number; readonly channels: 2; readonly frames: number }
  | { readonly kind: "chunk"; readonly id: string; readonly offset: number; readonly channels: readonly [readonly number[], readonly number[]] }
  /** Interleaved stereo Float32 little-endian bytes, losslessly base64 encoded. */
  | { readonly kind: "pcm"; readonly id: string; readonly offset: number; readonly data: string }
  | { readonly kind: "complete"; readonly id: string; readonly frames: number; readonly timing: MaxAudioTiming }
  | { readonly kind: "error"; readonly id: string; readonly error: string };
