// Inputs and outputs of every Live operation. The extension implements them; Ode's Live tools pass inputs through as they are.
import type {
  ArrangementClipRef,
  ClipRef,
  ClipSlotRef,
  DeviceRef,
  ExtensionOp,
  LocatorRef,
  LoopSettings,
  Note,
  ParameterRef,
  SceneRef,
  TakeLaneRef,
  TrackRef,
} from "./live";
import type { SetContents } from "./set-snapshot";
import type { MutationReceipt } from "./mutation-receipt";

export type TrackKind = "midi" | "audio" | "group" | "return" | "main";

export interface DeviceSummary {
  index: number;
  name: string;
  className: string;
  isRack: boolean;
}

export interface TrackSummary {
  index: number;
  name: string;
  kind: TrackKind;
  tag?: string;
  color: number;
  mute: boolean;
  solo: boolean;
  arm: boolean;
  devices: DeviceSummary[];
}

export interface SceneInfo {
  index: number;
  name: string;
  tempo: number;
  signatureNumerator: number;
  signatureDenominator: number;
}

export interface LocatorInfo {
  index: number;
  name: string;
  time: number;
}

export interface SongInfo {
  tempo: number;
  gridQuantization: number;
  gridIsTriplet: boolean;
  /** 0 = C … 11 = B */
  rootNote: number;
  scaleName: string;
  scaleMode: boolean;
  scaleIntervals: number[];
  tracks: TrackSummary[];
  returnTracks: TrackSummary[];
  scenes: SceneInfo[];
  locators: LocatorInfo[];
}

export interface ClipInfo {
  ref: ClipRef;
  kind: "midi" | "audio";
  name: string;
  tag?: string;
  color: number;
  muted: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  startMarker: number;
  endMarker: number;
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  /** MIDI clips in a snapshot: every note. */
  notes?: Note[];
}

export interface ClipSlotInfo {
  slot: number;
  clip: ClipInfo | null;
}

export interface TakeLaneInfo {
  lane: number;
  name: string;
  clips: ClipInfo[];
}

export interface TrackInfo extends TrackSummary {
  mutedViaSolo: boolean;
  groupTrack: number | null;
  clipSlots: ClipSlotInfo[];
  arrangementClips: ClipInfo[];
  takeLanes: TakeLaneInfo[];
}

export interface ParameterInfo {
  index: number;
  name: string;
  min: number;
  max: number;
  isQuantized: boolean;
  defaultValue: number;
  valueItems: string[];
  value?: number;
}

export interface ChainInfo {
  index: number;
  devices: DeviceSummary[];
  /** Drum Rack pads only. */
  receivingNote?: number;
}

export interface DeviceInfo extends DeviceSummary {
  parameters: ParameterInfo[];
  chains?: ChainInfo[];
  /** Simpler only: file path of the loaded sample. */
  sample?: string | null;
}

export interface MixerInfo {
  volume: ParameterInfo;
  panning: ParameterInfo;
  sends: ParameterInfo[];
}

export interface AudioClipInfo extends ClipInfo {
  filePath: string;
  warping: boolean;
  warpMode: number;
  warpMarkers: { sampleTime: number; beatTime: number }[];
}

export interface CreatedTrack {
  track: TrackRef;
  index: number;
  name: string;
  tag?: string;
}

export interface CreatedClip {
  clip: ClipRef;
  name: string;
  tag?: string;
}

export interface CreatedDevice {
  device: DeviceRef;
  name: string;
}

/** What the musician right-clicked in Live: a track, a clip, a scene, or, for a time selection, all three null. */
export interface SelectionInfo {
  track: TrackRef | null;
  clip: ClipRef | null;
  scene: number | null;
}

/** An explicitly known meter. The SDK's scene launch override is not the current Song meter. */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/** Live's default time signature, which a new Set starts in. */
export const LIVE_DEFAULT_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 };

type Named = { name?: string; tag?: string };

export interface ExtensionOpArgs {
  song_get: Record<string, never>;
  song_set_tempo: { tempo: number };
  song_create_midi_track: Named;
  song_create_audio_track: Named;
  song_delete_track: { track: TrackRef };
  song_duplicate_track: { track: TrackRef } & Named;
  song_create_scene: { index?: number; name?: string };
  song_delete_scene: { scene: SceneRef };
  song_duplicate_scene: { scene: SceneRef };
  song_create_locator: { time: number; name?: string };
  song_delete_locator: { locator: LocatorRef };
  locator_rename: { locator: LocatorRef; name: string };
  track_get: { track: TrackRef };
  track_set: { track: TrackRef; name?: string; mute?: boolean; solo?: boolean; arm?: boolean };
  track_create_midi_clip: { track: TrackRef; start: number; length: number; notes?: Note[] } & Named;
  track_create_audio_clip: { track: TrackRef; filePath: string; start: number; length?: number; warped?: boolean; loop?: LoopSettings } & Named;
  track_delete_clip: { clip: ArrangementClipRef | { tag: string } };
  track_clear_range: { track: TrackRef; start: number; end: number };
  track_create_take_lane: { track: TrackRef; name?: string };
  track_insert_device: { track: TrackRef; device: string; index?: number };
  track_delete_device: { device: DeviceRef };
  track_duplicate_device: { device: DeviceRef };
  take_lane_get: { lane: TakeLaneRef };
  take_lane_rename: { lane: TakeLaneRef; name: string };
  take_lane_create_midi_clip: { lane: TakeLaneRef; start: number; length: number; notes?: Note[] } & Named;
  take_lane_create_audio_clip: { lane: TakeLaneRef; filePath: string; start: number; length?: number; warped?: boolean; loop?: LoopSettings } & Named;
  clip_slot_get: { slot: ClipSlotRef };
  clip_slot_create_midi_clip: { slot: ClipSlotRef; length: number; notes?: Note[] } & Named;
  clip_slot_create_audio_clip: { slot: ClipSlotRef; filePath: string; warped?: boolean; loop?: LoopSettings } & Named;
  clip_slot_delete_clip: { slot: ClipSlotRef };
  clip_get: { clip: ClipRef };
  clip_set: { clip: ClipRef; name?: string; color?: number; muted?: boolean; looping?: boolean };
  midi_clip_get_notes: { clip: ClipRef; recoveryToken?: string };
  midi_clip_set_notes: { clip: ClipRef; notes: Note[]; expected?: { token: string; notes: Note[] } };
  audio_clip_get: { clip: ClipRef };
  audio_clip_set: { clip: ClipRef; warping?: boolean; warpMode?: number };
  device_get: { device: DeviceRef; withValues?: boolean };
  parameter_get: { parameter: ParameterRef };
  parameter_set: { parameter: ParameterRef; value: number };
  mixer_get: { track: TrackRef };
  rack_get_chains: { device: DeviceRef };
  rack_insert_chain: { device: DeviceRef; index?: number };
  /** device = the rack; chain = index of the chain inside it. */
  chain_insert_device: { device: DeviceRef; chain: number; name: string; index?: number };
  /** device = a device inside a chain (DeviceRef.chain gives the path). */
  chain_delete_device: { device: DeviceRef };
  chain_duplicate_device: { device: DeviceRef };
  /** device = the Drum Rack; chain = pad chain index. */
  drum_pad_set_note: { device: DeviceRef; chain: number; note: number };
  simpler_get_sample: { device: DeviceRef };
  simpler_replace_sample: { device: DeviceRef; filePath: string };
  scene_get: { scene: SceneRef };
  scene_rename: { scene: SceneRef; name: string };
  render_track_audio: { track: TrackRef; start: number; end: number };
  import_into_project: { filePath: string };
  apply_as_one_undo_step: { calls: { op: ExtensionOp; args: unknown }[] };
  set_snapshot: Record<string, never>;
}

export interface ExtensionOpResults {
  song_get: SongInfo;
  song_set_tempo: { tempo: number };
  song_create_midi_track: CreatedTrack;
  song_create_audio_track: CreatedTrack;
  song_delete_track: { deleted: true };
  song_duplicate_track: CreatedTrack;
  song_create_scene: SceneInfo;
  song_delete_scene: { deleted: true };
  song_duplicate_scene: SceneInfo;
  song_create_locator: LocatorInfo;
  song_delete_locator: { deleted: true };
  locator_rename: LocatorInfo;
  track_get: TrackInfo;
  track_set: TrackSummary;
  track_create_midi_clip: CreatedClip;
  track_create_audio_clip: CreatedClip;
  track_delete_clip: { deleted: true };
  track_clear_range: { cleared: true };
  track_create_take_lane: TakeLaneInfo;
  track_insert_device: CreatedDevice;
  track_delete_device: { deleted: true };
  track_duplicate_device: CreatedDevice;
  take_lane_get: TakeLaneInfo;
  take_lane_rename: TakeLaneInfo;
  take_lane_create_midi_clip: CreatedClip;
  take_lane_create_audio_clip: CreatedClip;
  clip_slot_get: ClipSlotInfo;
  clip_slot_create_midi_clip: CreatedClip;
  clip_slot_create_audio_clip: CreatedClip;
  clip_slot_delete_clip: { deleted: true };
  clip_get: ClipInfo;
  clip_set: ClipInfo;
  midi_clip_get_notes: { notes: Note[]; guardedRecovery?: true; recoveryToken?: string };
  midi_clip_set_notes: { count: number; __odeReceipts?: MutationReceipt[] };
  audio_clip_get: AudioClipInfo;
  audio_clip_set: AudioClipInfo;
  device_get: DeviceInfo;
  parameter_get: ParameterInfo;
  parameter_set: ParameterInfo;
  mixer_get: MixerInfo;
  rack_get_chains: { chains: ChainInfo[] };
  rack_insert_chain: ChainInfo;
  chain_insert_device: CreatedDevice;
  chain_delete_device: { deleted: true };
  chain_duplicate_device: CreatedDevice;
  drum_pad_set_note: ChainInfo;
  simpler_get_sample: { filePath: string | null };
  simpler_replace_sample: { filePath: string };
  scene_get: SceneInfo;
  scene_rename: SceneInfo;
  render_track_audio: { path: string };
  import_into_project: { path: string };
  apply_as_one_undo_step: { results: unknown[]; nativeTransactions: 1 | 2 };
  set_snapshot: SetContents;
}
