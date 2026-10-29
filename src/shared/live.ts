// Shared contract between Ode and Live, which Ode reaches through its extension's operations.

export type TrackRef =
  | { index: number }
  | { name: string }
  | { tag: string }
  | { main: true }
  | { returnIndex: number };

export interface ClipSlotRef {
  track: TrackRef;
  slot: number;
}

export interface ArrangementClipRef {
  track: TrackRef;
  /** Start of the clip in the Arrangement, in beats. */
  start: number;
  /** The take lane the clip is on, 0 for the first; the main lane when left out. */
  lane?: number;
}

export type ClipRef = ClipSlotRef | ArrangementClipRef | { tag: string };

export interface TakeLaneRef {
  track: TrackRef;
  lane: number;
}

/** DeviceRef.index of the mixer of a track or chain; its parameters are volume (0), pan (1) and sends (2+). */
export const MIXER_INDEX = -1;

/** How far apart two positions in beats can be and still be the same place: Live's positions are floating point. */
export const BEAT_TOLERANCE = 0.001;

export interface DeviceRef {
  track: TrackRef;
  /** Path into racks as pairs, from the track inwards: [rack device index, chain index, rack device index, chain index, …]. */
  chain?: number[];
  /** Device position in the track or innermost chain, or MIXER_INDEX for its mixer. */
  index: number;
}

export interface ParameterRef {
  device: DeviceRef;
  /** Parameter index or exact name. */
  parameter: number | string;
}

export type SceneRef = { index: number } | { name: string };

export type LocatorRef = { index: number } | { name: string } | { time: number };

export interface Note {
  pitch: number;
  /** Beats from the clip start. */
  start: number;
  /** Beats. */
  duration: number;
  velocity?: number;
  muted?: boolean;
  probability?: number;
  velocityDeviation?: number;
  releaseVelocity?: number;
}

export interface LoopSettings {
  looping: boolean;
  startMarker: number;
  endMarker: number;
  loopStart: number;
  loopEnd: number;
}

/** Tags mark objects Ode created: "Chorus melody ·o3f2". */
export const TAG_SEPARATOR = " ·";

export const EXTENSION_OPS = [
  "song_get",
  "song_set_tempo",
  "song_create_midi_track",
  "song_create_audio_track",
  "song_delete_track",
  "song_duplicate_track",
  "song_create_scene",
  "song_delete_scene",
  "song_duplicate_scene",
  "song_create_locator",
  "song_delete_locator",
  "locator_rename",
  "track_get",
  "track_set",
  "track_create_midi_clip",
  "track_create_audio_clip",
  "track_delete_clip",
  "track_clear_range",
  "track_create_take_lane",
  "track_insert_device",
  "track_delete_device",
  "track_duplicate_device",
  "take_lane_get",
  "take_lane_rename",
  "take_lane_create_midi_clip",
  "take_lane_create_audio_clip",
  "clip_slot_get",
  "clip_slot_create_midi_clip",
  "clip_slot_create_audio_clip",
  "clip_slot_delete_clip",
  "clip_get",
  "clip_set",
  "midi_clip_get_notes",
  "midi_clip_set_notes",
  "audio_clip_get",
  "audio_clip_set",
  "device_get",
  "parameter_get",
  "parameter_set",
  "mixer_get",
  "rack_get_chains",
  "rack_insert_chain",
  "chain_insert_device",
  "chain_delete_device",
  "chain_duplicate_device",
  "drum_pad_set_note",
  "simpler_get_sample",
  "simpler_replace_sample",
  "scene_get",
  "scene_rename",
  "render_track_audio",
  "import_into_project",
  "apply_as_one_undo_step",
  "set_snapshot",
] as const;
export type ExtensionOp = (typeof EXTENSION_OPS)[number];

/** What the musician pointed at with a right-click "Ask Ode". */
export interface LivePointer {
  scope: string;
  description: string;
  target: unknown;
  time: string;
}

/** Runs one of the extension's operations on the Set open in Live. */
export interface LiveLink {
  call<R = unknown>(op: string, args: unknown): Promise<R>;
}

export interface LiveConnections {
  extension: LiveLink;
}
