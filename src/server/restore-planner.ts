import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { MIXER_INDEX, type ClipRef, type DeviceRef, type ExtensionOp, type LoopSettings, type Note, type TrackRef } from "../shared/live";
import type { AudioClipInfo, ClipInfo, LocatorInfo, MixerInfo, SceneInfo } from "../shared/live-ops";
import type { DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import { ChangeKind, TrackList, type ClipField, type ClipKey, type SetChange, type TrackField, type TrackKey } from "../shared/versions";
import type { ClipAudio, ClipLoop } from "../mneme/set-diff";
import { BEAT_TOLERANCE, SetLookup } from "./set-lookup";

/** One Live operation of a restore. */
export interface PlannedCall {
  op: ExtensionOp;
  args: unknown;
  /** What the call puts back, in plain words, for when it fails. */
  label: string;
}

export interface RestorePlan {
  /** Steps in order; each runs after the ones before it, and a step's extension calls run as one undo step. */
  steps: PlannedCall[][];
  /** What can't be restored, in plain words. */
  skipped: string[];
}

/**
 * When each kind of call runs, in the order SetDiff.apply uses: changed values on what is there now;
 * removals, innermost and last first; the song's fields; then additions, outermost and first first,
 * with return tracks (and the sends to them) before new regular tracks, which come last because Live
 * places a new track after the selected one and only their tags find them. From Add on, even steps
 * create things and odd steps only set values, so a value Live refuses never holds up the rest.
 */
enum Stage {
  Values = 0,
  Remove = 1,
  SongStructure = 2,
  SongValues = 3,
  Add = 4,
}

/** From one creating step to the next one, with a step for values in between. */
const NEXT_CREATING_STEP = 2;

/** Live's own instruments, effects and racks: the devices that can be added back by name. */
const LIVE_DEVICES: ReadonlySet<string> = new Set([
  "Analog", "Collision", "Drift", "Drum Rack", "Drum Sampler", "Electric", "External Instrument", "Impulse", "Instrument Rack",
  "Meld", "Operator", "Sampler", "Simpler", "Tension", "Wavetable",
  "Amp", "Audio Effect Rack", "Auto Filter", "Auto Pan", "Auto Pan-Tremolo", "Auto Shift", "Beat Repeat", "Cabinet", "Channel EQ",
  "Chorus-Ensemble", "Compressor", "Corpus", "Delay", "Drum Buss", "Dynamic Tube", "Echo", "EQ Eight", "EQ Three", "Erosion",
  "External Audio Effect", "Filter Delay", "Gate", "Glue Compressor", "Grain Delay", "Hybrid Reverb", "Limiter", "Looper",
  "Multiband Dynamics", "Overdrive", "Pedal", "Phaser-Flanger", "Redux", "Resonators", "Reverb", "Roar", "Saturator", "Shifter",
  "Spectral Resonator", "Spectral Time", "Spectrum", "Tuner", "Utility", "Vinyl Distortion", "Vocoder",
  "Arpeggiator", "Chord", "MIDI Effect Rack", "Note Length", "Pitch", "Random", "Scale", "Velocity",
]);

/** Device classes added back as Live's own device, whatever the musician or a preset named them. */
const DEVICE_CLASSES: ReadonlyMap<string, string> = new Map([
  ["DrumRackDevice", "Drum Rack"],
  ["Simpler", "Simpler"],
]);

/** Calls that only set values: running one again after its step failed part way is harmless. */
const EDIT_OPS: ReadonlySet<string> = new Set([
  "song_set_tempo",
  "track_set",
  "clip_set",
  "midi_clip_set_notes",
  "audio_clip_set",
  "parameter_set",
  "locator_rename",
  "scene_rename",
  "drum_pad_set_note",
  "simpler_replace_sample",
]);

const SETTABLE_TRACK_FIELDS: ReadonlySet<TrackField> = new Set(["name", "mute", "solo", "arm"]);
/** Live keeps at least two warp markers on a warped clip; more means the musician placed some. */
const DEFAULT_WARP_MARKERS = 2;
/** A short tag for a track created again without one, so later steps can find it. */
const TAG_BYTES = 2;

/** Calls grouped by the step they run in. */
class StagedCalls {
  private readonly stages = new Map<number, PlannedCall[]>();
  private readonly lastInsertion = new Map<string, number>();

  add(stage: number, call: PlannedCall): void {
    const calls = this.stages.get(stage) ?? [];
    calls.push(call);
    this.stages.set(stage, calls);
  }

  /**
   * The first creating step from `from` on where nothing else is inserted into the same track or chain
   * (Live checks positions before a step runs, so two insertions into one place can't share a step).
   */
  insertionStage(container: string, from: number): number {
    const last = this.lastInsertion.get(container);
    const stage = last === undefined ? from : Math.max(from, last + NEXT_CREATING_STEP);
    this.lastInsertion.set(container, stage);
    return stage;
  }

  /** The next creating step after every step planned so far. */
  get nextCreatingStage(): number {
    const last = Math.max(Stage.Add, ...this.stages.keys());
    return last % NEXT_CREATING_STEP === 0 ? last + NEXT_CREATING_STEP : last + 1;
  }

  steps(): PlannedCall[][] {
    return [...this.stages.entries()].sort(([a], [b]) => a - b).map(([, calls]) => calls);
  }
}

/** Fields of one track or clip that are set together. */
interface MergedFields<R> {
  ref: R;
  fields: Record<string, unknown>;
  label: string;
}

/** A device a change adds, found by its track and its path into racks in the version restored. */
interface DeviceAddition {
  change: SetChange;
  track: TrackKey;
  chain: number[];
  index: number;
}

/** A removal, with how deep and how far along it is, so the innermost and last go first. */
interface Removal {
  call: PlannedCall;
  depth: number;
  index: number;
}

/**
 * Turns the changes from the current Set to an earlier version (SetDiff.between(current, target)) into
 * Live operations, ordered so each runs after what it needs. Removed and changed objects are addressed
 * by their place in the current Set, added ones by their place in the version restored. What Live
 * can't put back (plug-ins and presets, group tracks, return tracks, missing audio files, the key and time signature)
 * is listed as skipped.
 * Lead sheet changes need no Live calls: the restore writes the sheet back itself.
 */
export class RestorePlanner {
  private readonly staged = new StagedCalls();
  private readonly skipped: string[] = [];
  private readonly trackFields = new Map<string, MergedFields<TrackRef>>();
  private readonly clipFields = new Map<string, MergedFields<ClipRef>>();
  private readonly removals: Removal[] = [];
  private readonly lookup: SetLookup;
  private removedTracks: TrackKey[] = [];
  /** The removed tracks that are deleted (every one but a group track), which moves the tracks after them up. */
  private deletedTracks: TrackKey[] = [];
  private addedTracks: TrackKey[] = [];
  /** Devices removed or added whole: what is inside them goes with them. */
  private wholeDevices: { track: TrackKey; path: number[] }[] = [];
  /** Devices paired with a different device of the same class (other parameters): their values don't carry over. */
  private differentDevices: { track: TrackKey; path: number[] }[] = [];
  /** Where each return track the restore adds will be, by its place in the version restored. */

  constructor(private readonly current: SetSnapshot) {
    this.lookup = new SetLookup(current);
  }

  /** True for a call that only sets values, so running it again is harmless. */
  static isEdit(op: string): boolean {
    return EDIT_OPS.has(op);
  }

  /**
   * True when a restore can add the device back as it is: one of Live's own devices, with its sample file still there,
   * and every device inside its chains the same.
   */
  static canAddBack(device: DeviceSnapshot): boolean {
    if (RestorePlanner.insertName(device) === null) return false;
    if (device.sample && !existsSync(device.sample)) return false;
    return (device.chains ?? []).every((chain) => chain.devices.every((inner) => RestorePlanner.canAddBack(inner)));
  }

  /** True when a restore can create the track again with all its devices: a MIDI or audio track. */
  static canAddBackTrack(track: TrackSnapshot): boolean {
    const creatable = track.kind === "midi" || track.kind === "audio";
    return creatable && track.devices.every((device) => RestorePlanner.canAddBack(device));
  }

  plan(changes: SetChange[]): RestorePlan {
    const removed = RestorePlanner.presence(changes, "track", ChangeKind.Removed);
    this.removedTracks = removed.map((change) => RestorePlanner.trackOf(change));
    this.deletedTracks = removed
      .filter((change) => !RestorePlanner.isGroup(change) && RestorePlanner.trackOf(change).list === TrackList.Tracks)
      .map((change) => RestorePlanner.trackOf(change));
    this.addedTracks = RestorePlanner.presence(changes, "track", ChangeKind.Added).map((change) => RestorePlanner.trackOf(change));
    this.wholeDevices = [
      ...RestorePlanner.presence(changes, "device", ChangeKind.Removed),
      ...RestorePlanner.presence(changes, "device", ChangeKind.Added),
    ].map((change) => RestorePlanner.devicePlace(change));
    this.differentDevices = RestorePlanner.presence(changes, "device", ChangeKind.Changed)
      .filter((change) => RestorePlanner.isDifferentDevice(change))
      .map((change) => RestorePlanner.devicePlace(change));

    const additions: DeviceAddition[] = [];
    for (const change of changes) {
      const { target } = change;
      // The lead sheet is written back by the restore itself, after the Live calls.
      if (target.scope === "sheet") continue;
      if (target.scope === "song") {
        this.planSong(change);
      } else if (target.scope === "track") {
        if (target.field !== "present") this.planTrackField(change, target.track, target.field);
        else if (change.kind === ChangeKind.Removed) this.planTrackRemoval(change, target.track);
      } else if (target.scope === "clip") {
        if (this.coveredTrack(target.track)) continue;
        if (target.field === "present") this.planClipPresence(change, target.track, target.clip);
        else this.planClipField(change, target.track, target.clip, target.field);
      } else {
        const path = [...target.chain, target.index];
        const inside = (devices: { track: TrackKey; path: number[] }[]) => RestorePlanner.within(devices, target.track, path, false);
        if (this.coveredTrack(target.track) || inside(this.wholeDevices) || inside(this.differentDevices)) continue;
        if (target.field === "parameter") this.planParameter(change, target.track, target.chain, target.index, target.parameter);
        else if (change.kind === ChangeKind.Removed) this.planDeviceRemoval(change, target.track, target.chain, target.index);
        else if (change.kind === ChangeKind.Added) additions.push({ change, track: target.track, chain: target.chain, index: target.index });
        else this.planDeviceChange(change, target.track, target.chain, target.index);
      }
    }
    for (const { ref, fields, label } of this.trackFields.values()) this.staged.add(Stage.Values, { op: "track_set", args: { track: ref, ...fields }, label });
    for (const { ref, fields, label } of this.clipFields.values()) this.staged.add(Stage.Values, { op: "clip_set", args: { clip: ref, ...fields }, label });
    this.planRemovals();
    this.planNewReturnTracks(RestorePlanner.presence(changes, "track", ChangeKind.Added));
    for (const addition of RestorePlanner.inInsertOrder(additions)) this.planDeviceAddition(addition);
    this.planNewRegularTracks(RestorePlanner.presence(changes, "track", ChangeKind.Added));
    return { steps: this.staged.steps(), skipped: this.skipped };
  }

  // ─── Song ──────────────────────────────────────────────────────────────────

  private planSong(change: SetChange): void {
    if (change.target.scope !== "song") return;
    const { after, label } = change;
    switch (change.target.field) {
      case "tempo":
        if (typeof after === "number") this.staged.add(Stage.SongValues, { op: "song_set_tempo", args: { tempo: after }, label });
        else this.skipped.push(label);
        return;
      case "key":
      case "signature":
        // Live's key, scale and time signature stay with the musician.
        this.skipped.push(label);
        return;
      case "locators":
        this.planLocators(RestorePlanner.listOf<LocatorInfo>(change.before), RestorePlanner.listOf<LocatorInfo>(change.after));
        return;
      case "scenes":
        this.planScenes(RestorePlanner.listOf<SceneInfo>(change.before), RestorePlanner.listOf<SceneInfo>(change.after));
        return;
    }
  }

  /** Locators are matched by position: moved ones are removed and added again, renamed ones renamed. */
  private planLocators(before: LocatorInfo[], after: LocatorInfo[]): void {
    const at = (list: LocatorInfo[], time: number) => list.find((locator) => Math.abs(locator.time - time) <= BEAT_TOLERANCE);
    for (const locator of before) {
      const kept = at(after, locator.time);
      if (!kept) {
        this.staged.add(Stage.SongStructure, { op: "song_delete_locator", args: { locator: { time: locator.time } }, label: `locator "${locator.name}"` });
      } else if (kept.name !== locator.name) {
        this.staged.add(Stage.SongValues, { op: "locator_rename", args: { locator: { time: locator.time }, name: kept.name }, label: `locator "${kept.name}"` });
      }
    }
    for (const locator of after) {
      if (at(before, locator.time)) continue;
      const args = locator.name ? { time: locator.time, name: locator.name } : { time: locator.time };
      this.staged.add(Stage.SongStructure, { op: "song_create_locator", args, label: `locator "${locator.name}"` });
    }
  }

  /** Scenes are matched by position, like the clip slots in their rows; scenes go and come at the end. */
  private planScenes(before: SceneInfo[], after: SceneInfo[]): void {
    for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
      const was = after[index]!;
      const now = before[index]!;
      if (was.name !== now.name) {
        this.staged.add(Stage.SongValues, { op: "scene_rename", args: { scene: { index }, name: was.name }, label: `scene ${index + 1}` });
      }
      if (was.tempo !== now.tempo || was.signatureNumerator !== now.signatureNumerator || was.signatureDenominator !== now.signatureDenominator) {
        this.skipped.push(`Scene ${index + 1} · tempo and time signature`);
      }
    }
    for (let index = before.length - 1; index >= after.length; index -= 1) {
      this.staged.add(Stage.SongStructure, { op: "song_delete_scene", args: { scene: { index } }, label: `scene ${index + 1}` });
    }
    for (const scene of after.slice(before.length)) {
      this.staged.add(Stage.SongStructure, { op: "song_create_scene", args: scene.name ? { index: -1, name: scene.name } : { index: -1 }, label: `scene "${scene.name}"` });
    }
  }

  // ─── Tracks ────────────────────────────────────────────────────────────────

  private planTrackField(change: SetChange, key: TrackKey, field: TrackField): void {
    if (this.coveredTrack(key)) return;
    if (!SETTABLE_TRACK_FIELDS.has(field) || change.after === undefined) {
      this.skipped.push(change.label);
      return;
    }
    const ref = RestorePlanner.currentRef(key);
    const id = JSON.stringify(ref);
    const entry = this.trackFields.get(id) ?? { ref, fields: {}, label: `${key.name} · track settings` };
    entry.fields[field] = change.after;
    this.trackFields.set(id, entry);
  }

  /**
   * Deleting a group track in Live deletes its tracks too, so a group stays (its tracks go, one by one). Return tracks
   * are added and removed in Live itself.
   */
  private planTrackRemoval(change: SetChange, key: TrackKey): void {
    if (RestorePlanner.isGroup(change)) {
      this.skipped.push(`${key.name} (a group track stays; its tracks go one by one)`);
      return;
    }
    if (key.list === TrackList.Returns) {
      this.skipped.push(`${key.name} (return tracks are removed in Live)`);
    } else if (key.list === TrackList.Tracks) {
      this.removals.push({ call: { op: "song_delete_track", args: { track: RestorePlanner.currentRef(key) }, label: change.label }, depth: 0, index: key.index });
    }
  }

  /** Innermost and last first, so every index still points at what it should. */
  private planRemovals(): void {
    const ordered = [...this.removals].sort((a, b) => b.depth - a.depth || b.index - a.index);
    for (const removal of ordered) this.staged.add(Stage.Remove, removal.call);
  }

  /** Return tracks are added in Live itself, so a version's extra return tracks are listed as skipped. */
  private planNewReturnTracks(changes: SetChange[]): void {
    for (const change of changes.filter((entry) => RestorePlanner.trackOf(entry).list === TrackList.Returns)) {
      const track = change.after as TrackSnapshot | undefined;
      this.skipped.push(RestorePlanner.isTrack(track) ? `return track ${track.name} (return tracks are added in Live)` : change.label);
    }
  }

  /** New regular tracks come after every other step, found by their tags from then on. */
  private planNewRegularTracks(changes: SetChange[]): void {
    const regular: { track: TrackSnapshot; tag: string }[] = [];
    for (const change of changes.filter((entry) => RestorePlanner.trackOf(entry).list === TrackList.Tracks)) {
      const track = change.after as TrackSnapshot | undefined;
      if (!RestorePlanner.isTrack(track)) this.skipped.push(change.label);
      else if (track.kind !== "midi" && track.kind !== "audio") this.skipped.push(`${track.name} (a group track can't be created again)`);
      else regular.push({ track, tag: track.tag ?? randomBytes(TAG_BYTES).toString("hex") });
    }
    if (regular.length === 0) return;
    const createStage = this.staged.nextCreatingStage;
    for (const { track, tag } of regular) {
      const op = track.kind === "midi" ? "song_create_midi_track" : "song_create_audio_track";
      this.staged.add(createStage, { op, args: { name: track.name, tag }, label: `track ${track.name}` });
      if (track.groupTrack !== null) this.skipped.push(`${track.name} · its group`);
    }
    for (const { track, tag } of regular) this.fillTrack(track, { tag }, createStage + NEXT_CREATING_STEP);
  }

  /** A track created again: its mixer and settings (the step before `from`), its devices, clips and take lanes (from `from` on). */
  private fillTrack(track: TrackSnapshot, ref: TrackRef, from: number): void {
    this.planMixer(ref, track.mixer, from - 1, track.name);
    if (track.kind !== "return") {
      this.staged.add(from - 1, { op: "track_set", args: { track: ref, mute: track.mute, solo: track.solo, arm: track.arm }, label: `${track.name} · track settings` });
    }
    for (const device of track.devices) this.insertDevice(ref, [], device.index, device, from, track.name);
    for (const clip of track.arrangementClips) this.createClip(ref, track.name, { start: clip.startTime }, clip, from);
    for (const slot of track.clipSlots) if (slot.clip) this.createClip(ref, track.name, { slot: slot.slot }, slot.clip, from);
    for (const lane of track.takeLanes) {
      this.staged.add(from, { op: "track_create_take_lane", args: lane.name ? { track: ref, name: lane.name } : { track: ref }, label: `${track.name} · take lane ${lane.lane + 1}` });
      for (const clip of lane.clips) this.createClip(ref, track.name, { start: clip.startTime, lane: lane.lane }, clip, from + NEXT_CREATING_STEP);
    }
  }

  private planMixer(track: TrackRef, mixer: MixerInfo, stage: number, owner: string): void {
    [mixer.volume, mixer.panning, ...mixer.sends].forEach((parameter, index) => {
      if (typeof parameter.value !== "number") return;
      this.staged.add(stage, {
        op: "parameter_set",
        args: { parameter: { device: { track, index: MIXER_INDEX }, parameter: index }, value: parameter.value },
        label: `${owner} · mixer`,
      });
    });
  }

  // ─── Clips ─────────────────────────────────────────────────────────────────

  private planClipPresence(change: SetChange, key: TrackKey, clipKey: ClipKey): void {
    if (change.kind === ChangeKind.Removed) {
      const track = RestorePlanner.currentRef(key);
      const call: PlannedCall =
        "slot" in clipKey
          ? { op: "clip_slot_delete_clip", args: { slot: { track, slot: clipKey.slot } }, label: change.label }
          : { op: "track_delete_clip", args: { clip: { track, start: clipKey.start } }, label: change.label };
      this.removals.push({ call, depth: 1, index: "slot" in clipKey ? clipKey.slot : clipKey.start });
      return;
    }
    if (change.kind !== ChangeKind.Added) return;
    const clip = change.after as ClipInfo | undefined;
    if (!RestorePlanner.isClip(clip)) {
      this.skipped.push(change.label);
      return;
    }
    const lanes = key.list === TrackList.Tracks ? (this.current.tracks[key.index]?.takeLanes.length ?? 0) : 0;
    if ("lane" in clipKey && clipKey.lane !== undefined && clipKey.lane >= lanes) {
      this.skipped.push(`${key.name} · clip "${clip.name}" on take lane ${clipKey.lane + 1}`);
      return;
    }
    this.createClip(this.survivingRef(key), key.name, clipKey, clip, Stage.Add);
  }

  /** Creates a clip with its notes or its audio file (at a creating step), then sets its colour, mute, loop and warp mode. */
  private createClip(track: TrackRef, owner: string, key: ClipKey, clip: ClipInfo, stage: number): void {
    const label = `${owner} · clip "${clip.name}"`;
    const named = { ...(clip.name ? { name: clip.name } : {}), ...(clip.tag ? { tag: clip.tag } : {}) };
    const audio = clip.kind === "audio" ? (clip as AudioClipInfo) : null;
    if (audio && !(audio.filePath && existsSync(audio.filePath))) {
      this.skipped.push(`${label} (its audio file is missing)`);
      return;
    }
    const length = "slot" in key ? Math.max(clip.loopEnd, clip.endMarker) : clip.endTime - clip.startTime;
    if (!(length > 0)) {
      this.skipped.push(label);
      return;
    }
    if (audio) {
      const loop: LoopSettings = {
        looping: clip.looping,
        startMarker: clip.startMarker,
        endMarker: clip.endMarker,
        loopStart: clip.loopStart,
        loopEnd: clip.loopEnd,
      };
      const settings = { filePath: audio.filePath, warped: audio.warping, ...(audio.warping ? { loop } : {}), ...named };
      if ("slot" in key) this.staged.add(stage, { op: "clip_slot_create_audio_clip", args: { slot: { track, slot: key.slot }, ...settings }, label });
      else if (key.lane !== undefined) this.staged.add(stage, { op: "take_lane_create_audio_clip", args: { lane: { track, lane: key.lane }, start: key.start, length, ...settings }, label });
      else this.staged.add(stage, { op: "track_create_audio_clip", args: { track, start: key.start, length, ...settings }, label });
      if (audio.warping && audio.warpMarkers.length > DEFAULT_WARP_MARKERS) this.skipped.push(`${label} · warp markers`);
    } else {
      const notes = clip.notes ?? [];
      if ("slot" in key) this.staged.add(stage, { op: "clip_slot_create_midi_clip", args: { slot: { track, slot: key.slot }, length, notes, ...named }, label });
      else if (key.lane !== undefined) this.staged.add(stage, { op: "take_lane_create_midi_clip", args: { lane: { track, lane: key.lane }, start: key.start, length, notes, ...named }, label });
      else this.staged.add(stage, { op: "track_create_midi_clip", args: { track, start: key.start, length, notes, ...named }, label });
      if (clip.startMarker > BEAT_TOLERANCE || clip.loopStart > BEAT_TOLERANCE) this.skipped.push(`${label} · start and loop positions`);
    }
    const ref: ClipRef = clip.tag ? { tag: clip.tag } : "slot" in key ? { track, slot: key.slot } : { track, start: key.start };
    const canLoop = !audio || audio.warping;
    this.staged.add(stage + 1, { op: "clip_set", args: { clip: ref, color: clip.color, muted: clip.muted, ...(canLoop ? { looping: clip.looping } : {}) }, label });
    if (audio?.warping) this.staged.add(stage + 1, { op: "audio_clip_set", args: { clip: ref, warpMode: audio.warpMode }, label });
  }

  private planClipField(change: SetChange, key: TrackKey, clipKey: ClipKey, field: ClipField): void {
    const track = RestorePlanner.currentRef(key);
    const clip: ClipRef = "slot" in clipKey ? { track, slot: clipKey.slot } : { track, start: clipKey.start };
    const { after, before, label } = change;
    switch (field) {
      case "notes":
        if (Array.isArray(after)) this.staged.add(Stage.Values, { op: "midi_clip_set_notes", args: { clip, notes: after as Note[] }, label });
        else this.skipped.push(label);
        return;
      case "name":
      case "muted":
      case "color":
        if (after === undefined) this.skipped.push(label);
        else this.setClipField(clip, field, after, label);
        return;
      case "loop": {
        // Loop on or off can be set; where the loop, the markers and the clip's end are can't.
        const was = (after ?? {}) as Partial<ClipLoop>;
        const now = (before ?? {}) as Partial<ClipLoop>;
        if (typeof was.looping === "boolean" && was.looping !== now.looping) this.setClipField(clip, "looping", was.looping, label);
        const positions = ["loopStart", "loopEnd", "startMarker", "endMarker", "duration", "endTime"] as const;
        if (typeof was.looping !== "boolean" || positions.some((point) => was[point] !== now[point])) this.skipped.push(label);
        return;
      }
      case "audio": {
        // Warping and the warp mode can be set; the file and the warp markers can't.
        const was = (after ?? {}) as Partial<ClipAudio>;
        const now = (before ?? {}) as Partial<ClipAudio>;
        const settings = {
          ...(typeof was.warping === "boolean" && was.warping !== now.warping ? { warping: was.warping } : {}),
          ...(typeof was.warpMode === "number" && was.warpMode !== now.warpMode ? { warpMode: was.warpMode } : {}),
        };
        if (Object.keys(settings).length > 0) this.staged.add(Stage.Values, { op: "audio_clip_set", args: { clip, ...settings }, label });
        const markersMoved = JSON.stringify(was.warpMarkers ?? null) !== JSON.stringify(now.warpMarkers ?? null);
        if (was.filePath !== now.filePath || markersMoved || Object.keys(settings).length === 0) this.skipped.push(label);
        return;
      }
      default:
        this.skipped.push(label);
    }
  }

  private setClipField(clip: ClipRef, field: string, value: unknown, label: string): void {
    const id = JSON.stringify(clip);
    const entry = this.clipFields.get(id) ?? { ref: clip, fields: {}, label };
    entry.fields[field] = value;
    this.clipFields.set(id, entry);
  }

  // ─── Devices ───────────────────────────────────────────────────────────────

  private planDeviceRemoval(change: SetChange, key: TrackKey, chain: number[], index: number): void {
    const device: DeviceRef = { track: RestorePlanner.currentRef(key), ...(chain.length > 0 ? { chain } : {}), index };
    const op = chain.length > 0 ? "chain_delete_device" : "track_delete_device";
    this.removals.push({ call: { op, args: { device }, label: change.label }, depth: 2 + chain.length, index });
  }

  /** The device itself changed: a Simpler's sample is put back; its name, chains and pad notes can't be. */
  private planDeviceChange(change: SetChange, key: TrackKey, chain: number[], index: number): void {
    const before = change.before as DeviceSnapshot | undefined;
    const after = change.after as DeviceSnapshot | undefined;
    if (!RestorePlanner.isDevice(before) || !RestorePlanner.isDevice(after)) {
      this.skipped.push(change.label);
      return;
    }
    if (RestorePlanner.isDifferentDevice(change)) {
      this.skipped.push(`${key.name} · ${after.name} (${before.name} is in its place now)`);
      return;
    }
    const sampleChanged = (before.sample ?? null) !== (after.sample ?? null);
    if (sampleChanged && after.sample && existsSync(after.sample)) {
      const device: DeviceRef = { track: RestorePlanner.currentRef(key), ...(chain.length > 0 ? { chain } : {}), index };
      this.staged.add(Stage.Values, { op: "simpler_replace_sample", args: { device, filePath: after.sample }, label: change.label });
    } else if (sampleChanged) {
      this.skipped.push(`${change.label} (the sample file is missing)`);
    }
    // Live names a Simpler after its sample, so the old sample brings the old name back with it.
    const renamed = before.name !== after.name && !sampleChanged;
    if (renamed || RestorePlanner.chainsChanged(before, after)) this.skipped.push(change.label);
  }

  private planDeviceAddition({ change, track, chain, index }: DeviceAddition): void {
    const device = change.after as DeviceSnapshot | undefined;
    if (!RestorePlanner.isDevice(device)) this.skipped.push(change.label);
    else this.insertDevice(this.survivingRef(track), chain, index, device, Stage.Add, track.name);
  }

  /** Inserts one of Live's own devices (from the creating step `from` on), then its values, its Simpler sample, and a rack's chains with their devices. */
  private insertDevice(track: TrackRef, chain: number[], index: number, device: DeviceSnapshot, from: number, owner: string): void {
    const name = RestorePlanner.insertName(device);
    const label = `${owner} · ${device.name}`;
    if (!name) {
      this.skipped.push(`${label} (plug-ins and presets can't be added back)`);
      return;
    }
    const stage = this.staged.insertionStage(JSON.stringify([track, chain]), from);
    const ref: DeviceRef = { track, ...(chain.length > 0 ? { chain } : {}), index };
    if (chain.length === 0) {
      this.staged.add(stage, { op: "track_insert_device", args: { track, device: name, index }, label });
    } else {
      const outer = chain.slice(0, -2);
      const rack: DeviceRef = { track, ...(outer.length > 0 ? { chain: outer } : {}), index: chain[chain.length - 2]! };
      this.staged.add(stage, { op: "chain_insert_device", args: { device: rack, chain: chain[chain.length - 1]!, name, index }, label });
    }
    for (const parameter of device.parameters) {
      if (typeof parameter.value !== "number") continue;
      this.staged.add(stage + 1, { op: "parameter_set", args: { parameter: { device: ref, parameter: parameter.index }, value: parameter.value }, label });
    }
    if (device.sample) {
      if (existsSync(device.sample)) this.staged.add(stage + 1, { op: "simpler_replace_sample", args: { device: ref, filePath: device.sample }, label });
      else this.skipped.push(`${label} · sample (its file is missing)`);
    }
    const chainStage = stage + NEXT_CREATING_STEP;
    (device.chains ?? []).forEach((inner, position) => {
      this.staged.add(chainStage, { op: "rack_insert_chain", args: { device: ref }, label: `${label} · chain ${position + 1}` });
      if (inner.receivingNote !== undefined) {
        this.staged.add(chainStage + 1, { op: "drum_pad_set_note", args: { device: ref, chain: position, note: inner.receivingNote }, label: `${label} · pad ${position + 1}` });
      }
      for (const nested of inner.devices) this.insertDevice(track, [...chain, index, position], nested.index, nested, chainStage + NEXT_CREATING_STEP, owner);
    });
  }

  private planParameter(change: SetChange, key: TrackKey, chain: number[], index: number, parameter: number | undefined): void {
    if (typeof change.after !== "number" || parameter === undefined) {
      this.skipped.push(change.label);
      return;
    }
    // A different device sits there now: the old device's values mean nothing to it (the device is listed as skipped).
    if (RestorePlanner.within(this.differentDevices, key, [...chain, index], true)) return;
    if (change.kind !== ChangeKind.Added) {
      const device: DeviceRef = { track: RestorePlanner.currentRef(key), ...(chain.length > 0 ? { chain } : {}), index };
      this.staged.add(Stage.Values, { op: "parameter_set", args: { parameter: { device, parameter }, value: change.after }, label: change.label });
      return;
    }
    // A parameter the version had and the Set lacks, such as a send to a return track added in Live.
    this.skipped.push(change.label);
  }

  // ─── References ────────────────────────────────────────────────────────────

  /** A track as the Set is now: by its tag, or by its place. */
  private static currentRef(key: TrackKey): TrackRef {
    if (key.tag) return { tag: key.tag };
    if (key.list === TrackList.Main) return { main: true };
    return key.list === TrackList.Returns ? { returnIndex: key.index } : { index: key.index };
  }

  /** A track that stays, once the tracks deleted before it are gone. */
  private survivingRef(key: TrackKey): TrackRef {
    if (key.tag) return { tag: key.tag };
    if (key.list === TrackList.Main) return { main: true };
    const deletedBefore = this.deletedTracks.filter((deleted) => deleted.list === key.list && deleted.index < key.index).length;
    return key.list === TrackList.Returns ? { returnIndex: key.index - deletedBefore } : { index: key.index - deletedBefore };
  }

  /** Changes on a removed or re-created track are covered by removing or creating the whole track. */
  private coveredTrack(key: TrackKey): boolean {
    return [...this.removedTracks, ...this.addedTracks].some((track) => RestorePlanner.sameTrack(track, key));
  }

  /**
   * True when the path is inside one of the devices (or is one of them, with `orItself`): changes inside a
   * removed or added rack go with it, and nothing of a different device's carries over.
   */
  private static within(devices: { track: TrackKey; path: number[] }[], key: TrackKey, path: number[], orItself: boolean): boolean {
    return devices.some(
      (device) =>
        RestorePlanner.sameTrack(device.track, key) &&
        (orItself ? device.path.length <= path.length : device.path.length < path.length) &&
        device.path.every((step, position) => path[position] === step),
    );
  }

  private static sameTrack(a: TrackKey, b: TrackKey): boolean {
    return a.list === b.list && a.index === b.index && a.name === b.name && a.tag === b.tag;
  }

  /** The changes that add, remove or (for devices) change a whole object. */
  private static presence(changes: SetChange[], scope: "track" | "device", kind: ChangeKind): SetChange[] {
    return changes.filter((change) => change.target.scope === scope && change.target.field === "present" && change.kind === kind);
  }

  private static isGroup(change: SetChange): boolean {
    return (change.before as TrackSnapshot | undefined)?.kind === "group";
  }

  private static trackOf(change: SetChange): TrackKey {
    return (change.target as { track: TrackKey }).track;
  }

  private static devicePlace(change: SetChange): { track: TrackKey; path: number[] } {
    const { track, chain, index } = change.target as { track: TrackKey; chain: number[]; index: number };
    return { track, path: [...chain, index] };
  }

  /**
   * SetDiff pairs devices of the same class in chain order, and most of Live's devices share one class: a
   * pair whose parameters differ is two different devices, not one that changed.
   */
  private static isDifferentDevice(change: SetChange): boolean {
    const before = change.before as DeviceSnapshot | undefined;
    const after = change.after as DeviceSnapshot | undefined;
    if (!RestorePlanner.isDevice(before) || !RestorePlanner.isDevice(after)) return false;
    const names = (device: DeviceSnapshot) => device.parameters.map((parameter) => parameter.name).join("\n");
    return names(before) !== names(after);
  }

  private static chainsChanged(before: DeviceSnapshot, after: DeviceSnapshot): boolean {
    const earlier = before.chains ?? [];
    const later = after.chains ?? [];
    return earlier.length !== later.length || earlier.some((chain, position) => chain.receivingNote !== later[position]?.receivingNote);
  }

  /** The name Live adds a device back by, or null for a plug-in or a preset. */
  private static insertName(device: DeviceSnapshot): string | null {
    return DEVICE_CLASSES.get(device.className) ?? (LIVE_DEVICES.has(device.name) ? device.name : null);
  }

  /** Per track and chain, from the first position to the last, so each insertion lands where it belongs. */
  private static inInsertOrder(additions: DeviceAddition[]): DeviceAddition[] {
    const container = (addition: DeviceAddition) => JSON.stringify([addition.track.list, addition.track.index, addition.chain]);
    return [...additions].sort((a, b) => {
      const byContainer = container(a).localeCompare(container(b));
      return byContainer !== 0 ? byContainer : a.index - b.index;
    });
  }

  // ─── Shapes of before and after ───────────────────────────────────────────

  /** A whole list, as SetDiff keeps locators and scenes. */
  private static listOf<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private static isTrack(value: TrackSnapshot | undefined): value is TrackSnapshot {
    return typeof value?.name === "string" && Array.isArray(value.devices) && Array.isArray(value.clipSlots) && value.mixer !== undefined;
  }

  private static isClip(value: ClipInfo | undefined): value is ClipInfo {
    return typeof value?.startTime === "number" && typeof value.endTime === "number" && (value.kind === "midi" || value.kind === "audio");
  }

  private static isDevice(value: DeviceSnapshot | undefined): value is DeviceSnapshot {
    return typeof value?.name === "string" && Array.isArray(value.parameters);
  }
}
