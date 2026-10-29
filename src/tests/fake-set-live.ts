import type { ArrangementClipRef, ClipRef, ClipSlotRef, DeviceRef, LiveConnections, LiveLink, LocatorRef, Note, ParameterRef, SceneRef, TrackRef } from "../shared/live";
import { MIXER_INDEX } from "../shared/live";
import type { ClipInfo, ExtensionOpArgs, MixerInfo, ParameterInfo, TrackSummary } from "../shared/live-ops";
import type { ChainSnapshot, DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";

type Handler = (args: never) => unknown;

/** Beats within which two Arrangement positions count as the same. */
const SAME_BEAT = 0.001;

/** The fake's way into Live: a table of the extension's operations by name. */
export class FakeLink implements LiveLink {
  constructor(
    private readonly handlers: Readonly<Record<string, Handler>>,
    private readonly log: { op: string; args: unknown }[],
  ) {}

  async call<R = unknown>(op: string, args: unknown): Promise<R> {
    const handler = this.handlers[op];
    if (!handler) throw new Error(`the fake extension has no operation "${op}"`);
    this.log.push({ op, args });
    return handler(structuredClone(args ?? {}) as never) as R;
  }
}

/**
 * A Live Set held in memory as a SetSnapshot. It answers the extension's operations the way Live would, so tests and
 * skill scenarios can run Ode against a known Set.
 */
export class FakeSetLive implements LiveConnections {
  readonly calls: { op: string; args: unknown }[] = [];
  readonly extension: FakeLink;
  private state: SetSnapshot;

  constructor(
    initial: SetSnapshot,
    private readonly templates: Readonly<Record<string, DeviceSnapshot>> = {},
  ) {
    this.state = structuredClone(initial);
    this.extension = new FakeLink(this.extensionHandlers(), this.calls);
  }

  /** The Set as it is now. */
  snapshot(): SetSnapshot {
    return structuredClone({ ...this.state, takenAt: new Date().toISOString() });
  }

  /** Changes the Set the way the musician would by hand, without logging an operation. */
  edit(change: (set: SetSnapshot) => void): void {
    change(this.state);
  }

  private extensionHandlers(): Record<string, Handler> {
    return {
      set_snapshot: () => {
        const { song, signature, tracks, returnTracks, main } = this.state;
        return structuredClone({ song, signature, tracks, returnTracks, main });
      },
      song_get: () => ({
        ...this.state.song,
        tracks: this.state.tracks.map((track) => this.summary(track)),
        returnTracks: this.state.returnTracks.map((track) => this.summary(track)),
      }),
      song_set_tempo: ({ tempo }: ExtensionOpArgs["song_set_tempo"]) => {
        this.state.song.tempo = tempo;
        return { tempo };
      },
      song_create_midi_track: (args: ExtensionOpArgs["song_create_midi_track"]) => this.createTrack("midi", args.name, args.tag),
      song_create_audio_track: (args: ExtensionOpArgs["song_create_audio_track"]) => this.createTrack("audio", args.name, args.tag),
      song_delete_track: ({ track }: ExtensionOpArgs["song_delete_track"]) => {
        const found = this.track(track);
        this.state.tracks = this.state.tracks.filter((candidate) => candidate !== found);
        this.state.tracks.forEach((candidate, index) => (candidate.index = index));
        return { deleted: true };
      },
      track_get: ({ track }: ExtensionOpArgs["track_get"]) => {
        const found = this.track(track);
        return { ...found, devices: found.devices.map(({ index, name, className, isRack }) => ({ index, name, className, isRack })) };
      },
      track_set: ({ track, name, mute, solo, arm }: ExtensionOpArgs["track_set"]) => {
        const found = this.track(track);
        if (name !== undefined) found.name = name;
        if (mute !== undefined) found.mute = mute;
        if (solo !== undefined) found.solo = solo;
        if (arm !== undefined) found.arm = arm;
        return this.summary(found);
      },
      track_create_midi_clip: (args: ExtensionOpArgs["track_create_midi_clip"]) => {
        const track = this.track(args.track);
        const clip = FakeSetLive.newClip({ track: args.track, start: args.start }, args.name, args.tag, args.start, args.length, args.notes ?? []);
        track.arrangementClips.push(clip);
        track.arrangementClips.sort((a, b) => a.startTime - b.startTime);
        return { clip: clip.ref, name: clip.name, tag: args.tag };
      },
      track_create_audio_clip: (args: ExtensionOpArgs["track_create_audio_clip"]) => {
        const track = this.track(args.track);
        const length = args.length ?? 4;
        const clip = { ...FakeSetLive.newClip({ track: args.track, start: args.start }, args.name, args.tag, args.start, length, []), kind: "audio" as const, notes: undefined, filePath: args.filePath, warping: args.warped ?? true, warpMode: 0, warpMarkers: [] };
        track.arrangementClips.push(clip);
        return { clip: clip.ref, name: clip.name, tag: args.tag };
      },
      track_delete_clip: ({ clip }: ExtensionOpArgs["track_delete_clip"]) => {
        this.removeClip(clip);
        return { deleted: true };
      },
      clip_slot_create_midi_clip: (args: ExtensionOpArgs["clip_slot_create_midi_clip"]) => {
        const slot = this.slot(args.slot);
        const clip = FakeSetLive.newClip(args.slot, args.name, args.tag, 0, args.length, args.notes ?? []);
        slot.clip = clip;
        return { clip: clip.ref, name: clip.name, tag: args.tag };
      },
      clip_slot_delete_clip: ({ slot }: ExtensionOpArgs["clip_slot_delete_clip"]) => {
        this.slot(slot).clip = null;
        return { deleted: true };
      },
      clip_get: ({ clip }: ExtensionOpArgs["clip_get"]) => this.clip(clip),
      clip_set: ({ clip, name, color, muted, looping }: ExtensionOpArgs["clip_set"]) => {
        const found = this.clip(clip);
        if (name !== undefined) found.name = name;
        if (color !== undefined) found.color = color;
        if (muted !== undefined) found.muted = muted;
        if (looping !== undefined) found.looping = looping;
        return found;
      },
      midi_clip_get_notes: ({ clip }: ExtensionOpArgs["midi_clip_get_notes"]) => ({ notes: this.midiClip(clip).notes ?? [] }),
      midi_clip_set_notes: ({ clip, notes }: ExtensionOpArgs["midi_clip_set_notes"]) => {
        this.midiClip(clip).notes = notes;
        return { count: notes.length };
      },
      device_get: ({ device }: ExtensionOpArgs["device_get"]) => this.findDevice(device),
      parameter_get: ({ parameter }: ExtensionOpArgs["parameter_get"]) => this.parameter(parameter),
      parameter_set: ({ parameter, value }: ExtensionOpArgs["parameter_set"]) => {
        const found = this.parameter(parameter);
        found.value = Math.min(found.max, Math.max(found.min, value));
        return found;
      },
      mixer_get: ({ track }: ExtensionOpArgs["mixer_get"]) => this.track(track).mixer,
      track_insert_device: ({ track, device, index }: ExtensionOpArgs["track_insert_device"]) => {
        const found = this.track(track);
        const position = index ?? found.devices.length;
        found.devices.splice(position, 0, this.newDevice(device, position));
        found.devices.forEach((candidate, i) => (candidate.index = i));
        return { device: { track, index: position }, name: device };
      },
      track_delete_device: ({ device }: ExtensionOpArgs["track_delete_device"]) => {
        const list = this.deviceList(device);
        list.splice(device.index, 1);
        list.forEach((candidate, i) => (candidate.index = i));
        return { deleted: true };
      },
      chain_insert_device: ({ device, chain, name, index }: ExtensionOpArgs["chain_insert_device"]) => {
        const target = this.chain(this.findDevice(device), chain);
        const position = index ?? target.devices.length;
        target.devices.splice(position, 0, this.newDevice(name, position));
        target.devices.forEach((candidate, i) => (candidate.index = i));
        return { device: { track: device.track, chain: [...(device.chain ?? []), device.index, chain], index: position }, name };
      },
      chain_delete_device: ({ device }: ExtensionOpArgs["chain_delete_device"]) => {
        const list = this.deviceList(device);
        list.splice(device.index, 1);
        list.forEach((candidate, i) => (candidate.index = i));
        return { deleted: true };
      },
      song_create_locator: ({ time, name }: ExtensionOpArgs["song_create_locator"]) => {
        const locator = { index: 0, name: name ?? "", time };
        this.state.song.locators = [...this.state.song.locators, locator].sort((a, b) => a.time - b.time).map((item, index) => ({ ...item, index }));
        return this.state.song.locators.find((item) => item.time === time);
      },
      song_delete_locator: ({ locator }: ExtensionOpArgs["song_delete_locator"]) => {
        const found = this.locator(locator);
        this.state.song.locators = this.state.song.locators.filter((item) => item !== found).map((item, index) => ({ ...item, index }));
        return { deleted: true };
      },
      locator_rename: ({ locator, name }: ExtensionOpArgs["locator_rename"]) => {
        const found = this.locator(locator);
        found.name = name;
        return found;
      },
      song_create_scene: ({ index, name }: ExtensionOpArgs["song_create_scene"]) => {
        const scenes = this.state.song.scenes;
        const position = index ?? scenes.length;
        scenes.splice(position, 0, { index: position, name: name ?? "", tempo: this.state.song.tempo, signatureNumerator: 4, signatureDenominator: 4 });
        scenes.forEach((scene, i) => (scene.index = i));
        return scenes[position];
      },
      song_delete_scene: ({ scene }: ExtensionOpArgs["song_delete_scene"]) => {
        const found = this.scene(scene);
        this.state.song.scenes = this.state.song.scenes.filter((item) => item !== found).map((item, index) => ({ ...item, index }));
        return { deleted: true };
      },
      scene_rename: ({ scene, name }: ExtensionOpArgs["scene_rename"]) => {
        const found = this.scene(scene);
        found.name = name;
        return found;
      },
      render_track_audio: () => FakeSetLive.noAudio(),
      apply_as_one_undo_step: ({ calls }: ExtensionOpArgs["apply_as_one_undo_step"]) => {
        const handlers = this.extensionHandlers();
        const results = calls.map((call) => {
          const handler = handlers[call.op];
          if (!handler) throw new Error(`${call.op} can't be grouped`);
          return handler(structuredClone(call.args) as never);
        });
        return { results };
      },
    };
  }

  private summary(track: TrackSnapshot): TrackSummary {
    const { index, name, kind, tag, color, mute, solo, arm, devices } = track;
    return { index, name, kind, tag, color, mute, solo, arm, devices: devices.map(({ index: i, name: n, className, isRack }) => ({ index: i, name: n, className, isRack })) };
  }

  private createTrack(kind: "midi" | "audio", name: string | undefined, tag: string | undefined) {
    const index = this.state.tracks.length;
    const trackName = name ?? `${index + 1}-Track`;
    const track: TrackSnapshot = {
      index,
      name: trackName,
      kind,
      tag,
      color: 0,
      mute: false,
      solo: false,
      arm: false,
      mutedViaSolo: false,
      groupTrack: null,
      clipSlots: [],
      arrangementClips: [],
      takeLanes: [],
      mixer: FakeSetLive.newMixer(),
      devices: [],
    };
    this.state.tracks.push(track);
    return { track: { index }, index, name: trackName, tag };
  }

  private track(ref: TrackRef): TrackSnapshot {
    const all = [...this.state.tracks, ...this.state.returnTracks, this.state.main];
    let found: TrackSnapshot | undefined;
    if ("index" in ref) found = this.state.tracks[ref.index];
    else if ("returnIndex" in ref) found = this.state.returnTracks[ref.returnIndex];
    else if ("main" in ref) found = this.state.main;
    else if ("tag" in ref) found = all.find((track) => track.tag === ref.tag);
    else found = all.find((track) => track.name === ref.name);
    if (!found) throw new Error(`not found: track ${JSON.stringify(ref)}`);
    return found;
  }

  private slot(ref: ClipSlotRef): { slot: number; clip: ClipInfo | null } {
    const track = this.track(ref.track);
    while (track.clipSlots.length <= ref.slot) track.clipSlots.push({ slot: track.clipSlots.length, clip: null });
    const slot = track.clipSlots[ref.slot];
    if (!slot) throw new Error(`not found: clip slot ${ref.slot}`);
    return slot;
  }

  private clip(ref: ClipRef): ClipInfo {
    if ("tag" in ref) {
      for (const track of [...this.state.tracks, ...this.state.returnTracks]) {
        const clips = [...track.clipSlots.flatMap((slot) => (slot.clip ? [slot.clip] : [])), ...track.arrangementClips, ...track.takeLanes.flatMap((lane) => lane.clips)];
        const found = clips.find((clip) => clip.tag === ref.tag);
        if (found) return found;
      }
      throw new Error(`not found: clip tagged "${ref.tag}"`);
    }
    if ("slot" in ref) {
      const clip = this.slot(ref).clip;
      if (!clip) throw new Error(`not found: clip in slot ${ref.slot}`);
      return clip;
    }
    const track = this.track(ref.track);
    const startsThere = (clip: ClipInfo) => Math.abs(clip.startTime - ref.start) <= SAME_BEAT;
    const found = track.arrangementClips.find(startsThere) ?? track.takeLanes.flatMap((lane) => lane.clips).find(startsThere);
    if (!found) throw new Error(`not found: Arrangement clip at beat ${ref.start}`);
    return found;
  }

  private midiClip(ref: ClipRef): ClipInfo {
    const clip = this.clip(ref);
    if (clip.kind !== "midi") throw new Error("not a MIDI clip");
    return clip;
  }

  private removeClip(ref: ArrangementClipRef | { tag: string }): void {
    const clip = this.clip(ref);
    for (const track of this.state.tracks) {
      track.arrangementClips = track.arrangementClips.filter((candidate) => candidate !== clip);
      for (const lane of track.takeLanes) lane.clips = lane.clips.filter((candidate) => candidate !== clip);
    }
  }

  /** The list a device reference indexes into: the track's devices, or a chain's. */
  private deviceList(ref: DeviceRef): DeviceSnapshot[] {
    let list = this.track(ref.track).devices;
    const path = ref.chain ?? [];
    for (let step = 0; step + 1 < path.length; step += 2) {
      const rack = list[path[step] ?? -1];
      const chain = rack?.chains?.[path[step + 1] ?? -1];
      if (!chain) throw new Error(`not found: chain path ${JSON.stringify(path)}`);
      list = chain.devices;
    }
    return list;
  }

  private findDevice(ref: DeviceRef): DeviceSnapshot {
    const found = this.deviceList(ref)[ref.index];
    if (!found) throw new Error(`not found: device ${ref.index}`);
    return found;
  }

  private chain(rack: DeviceSnapshot, index: number): ChainSnapshot {
    const chain = rack.chains?.[index];
    if (!chain) throw new Error(`not found: chain ${index}`);
    return chain;
  }

  private parameter(ref: ParameterRef): ParameterInfo {
    const parameters =
      ref.device.index === MIXER_INDEX
        ? FakeSetLive.mixerParameters(this.track(ref.device.track).mixer)
        : this.findDevice(ref.device).parameters;
    const found =
      typeof ref.parameter === "number" ? parameters[ref.parameter] : parameters.find((parameter) => parameter.name === ref.parameter);
    if (!found) throw new Error(`not found: parameter ${String(ref.parameter)}`);
    return found;
  }

  private locator(ref: LocatorRef) {
    const locators = this.state.song.locators;
    const found =
      "index" in ref ? locators[ref.index] : "time" in ref ? locators.find((item) => Math.abs(item.time - ref.time) <= SAME_BEAT) : locators.find((item) => item.name === ref.name);
    if (!found) throw new Error(`not found: locator ${JSON.stringify(ref)}`);
    return found;
  }

  private scene(ref: SceneRef) {
    const found = "index" in ref ? this.state.song.scenes[ref.index] : this.state.song.scenes.find((scene) => scene.name === ref.name);
    if (!found) throw new Error(`not found: scene ${JSON.stringify(ref)}`);
    return found;
  }

  private newDevice(name: string, index: number): DeviceSnapshot {
    const template = this.templates[name];
    if (template) return { ...structuredClone(template), index };
    return { index, name, className: name, isRack: false, parameters: [FakeSetLive.newParameter(0, "Device On", 0, 1, 1)] };
  }

  private static newClip(ref: ClipRef, name: string | undefined, tag: string | undefined, start: number, length: number, notes: Note[]): ClipInfo {
    return {
      ref,
      kind: "midi",
      name: name ?? "",
      tag,
      color: 0,
      muted: false,
      startTime: start,
      endTime: start + length,
      duration: length,
      startMarker: 0,
      endMarker: length,
      looping: true,
      loopStart: 0,
      loopEnd: length,
      notes,
    };
  }

  private static newMixer(): MixerInfo {
    return { volume: FakeSetLive.newParameter(0, "Track Volume", 0, 1, 0.85), panning: FakeSetLive.newParameter(1, "Track Panning", -1, 1, 0), sends: [] };
  }

  private static mixerParameters(mixer: MixerInfo): ParameterInfo[] {
    return [mixer.volume, mixer.panning, ...mixer.sends];
  }

  /** The fake Set holds notes and settings but no sound, so nothing can be rendered or measured. */
  private static noAudio(): never {
    throw new Error("This test Set has no audio, so nothing can be rendered or measured; in Live this works.");
  }

  private static newParameter(index: number, name: string, min: number, max: number, value: number): ParameterInfo {
    return { index, name, min, max, isQuantized: false, defaultValue: value, valueItems: [], value };
  }
}
