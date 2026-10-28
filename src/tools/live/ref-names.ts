import { MIXER_INDEX, type ClipRef, type DeviceRef, type LocatorRef, type ParameterRef, type SceneRef, type TakeLaneRef, type TrackRef } from "../../shared/live";
import type { ClipInfo, ParameterInfo } from "../../shared/live-ops";
import { noteName } from "../../shared/notes";
import type { DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../../shared/set-snapshot";
import { LyricsText } from "../../mneme/lyrics-text";
import { LyricsWording, SetWording } from "../../mneme/set-diff";

/** How far apart, in beats, a reference's start and a clip's start can be and still be the same clip. */
const BEAT_TOLERANCE = 0.001;
/** The mixer's parameters, numbered as in DeviceRef: volume, pan, then one send per return track. */
const VOLUME_PARAMETER = 0;
const PAN_PARAMETER = 1;
const FIRST_SEND_PARAMETER = 2;
/** Between the parts of a name, as in History: "Bass · EQ Eight · 1 Frequency A". */
const SEPARATOR = " · ";
const MAIN_TRACK = "Main track";

/** A device found along a chain path: its name with the racks and chains around it, and the device itself. */
interface FoundDevice {
  parts: string[];
  device: DeviceSnapshot | undefined;
}

/**
 * What tool calls touch, named as the musician sees it in the latest snapshot of the Set: "Bass · EQ Eight", "Bass ·
 * clip Bass A", "bars 9–16". Anything the snapshot doesn't have (or every reference, before the first snapshot) is named
 * by its place instead: "track 2 · device 1", "beat 32".
 */
export class RefNames {
  private readonly beatsPerBar: number | null;

  constructor(private readonly set: SetSnapshot | null) {
    this.beatsPerBar = set ? SetWording.beatsPerBar(set.transport.signature) : null;
  }

  /** "Bass", "A-Reverb", "Main track"; otherwise "track 2", "return track 1", "the track tagged x3f". */
  track(ref: TrackRef): string {
    if ("main" in ref) return MAIN_TRACK;
    const found = this.findTrack(ref);
    const name = found ? SetWording.name(found) : "";
    if (name) return name;
    if ("index" in ref) return `track ${ref.index + 1}`;
    if ("returnIndex" in ref) return `return track ${ref.returnIndex + 1}`;
    if ("tag" in ref) return `the track tagged ${ref.tag}`;
    return ref.name;
  }

  /** "Bass · clip Bass A", "Bass · clip in bars 9–16", "Bass · slot 3"; otherwise where the reference points. */
  clip(ref: ClipRef): string {
    if ("tag" in ref) return this.taggedClip(ref.tag);
    const track = this.track(ref.track);
    const owner = this.findTrack(ref.track);
    if ("slot" in ref) {
      const clip = owner?.clipSlots[ref.slot]?.clip;
      const name = clip ? SetWording.name(clip) : "";
      return [track, name ? `clip ${name}` : `slot ${ref.slot + 1}`].join(SEPARATOR);
    }
    const start = ref.start;
    const clip = owner ? RefNames.clipsOf(owner).find((candidate) => Math.abs(candidate.startTime - start) <= BEAT_TOLERANCE) : undefined;
    if (!clip) return [track, `clip at ${this.position(start)}`].join(SEPARATOR);
    const name = SetWording.name(clip);
    return [track, name ? `clip ${name}` : `clip in ${this.span(clip.startTime, clip.endTime)}`].join(SEPARATOR);
  }

  /** "Vocals · take lane 2". */
  takeLane(ref: TakeLaneRef): string {
    return [this.track(ref.track), `take lane ${ref.lane + 1}`].join(SEPARATOR);
  }

  /** "Bass · slot 3", for a slot that may be empty. */
  slot(ref: { track: TrackRef; slot: number }): string {
    return [this.track(ref.track), `slot ${ref.slot + 1}`].join(SEPARATOR);
  }

  /** "Bass · EQ Eight", "Drums · Drum Rack · pad C1 · Simpler", "Bass · mixer"; otherwise "Bass · device 2". */
  device(ref: DeviceRef): string {
    const { parts, device } = this.findDevice(ref);
    const last = ref.index === MIXER_INDEX ? "mixer" : (device?.name ?? `device ${ref.index + 1}`);
    return [this.track(ref.track), ...parts, last].join(SEPARATOR);
  }

  /** A chain of a rack: "Drums · Drum Rack · pad C1", "Pad · Instrument Rack · chain 2". */
  chain(rack: DeviceRef, chain: number): string {
    const { device } = this.findDevice(rack);
    const found = device?.chains?.[chain];
    const name = found?.receivingNote === undefined ? `chain ${chain + 1}` : `pad ${noteName(found.receivingNote)}`;
    return [this.device(rack), name].join(SEPARATOR);
  }

  /** "Bass · EQ Eight · 1 Frequency A", "Bass · volume", "Bass · send A-Reverb"; otherwise "Bass · EQ Eight · parameter 3". */
  parameter(ref: ParameterRef): string {
    const where = ref.device.index === MIXER_INDEX ? this.mixerPlace(ref.device) : this.device(ref.device);
    return [where, this.parameterName(ref)].join(SEPARATOR);
  }

  /** A value in the parameter's own words: "Lowpass" for a chooser, "25L" for pan, otherwise the number. */
  value(ref: ParameterRef, value: number): string {
    if (ref.device.index === MIXER_INDEX && ref.parameter === PAN_PARAMETER) return SetWording.pan(value);
    const parameter = this.findParameter(ref);
    return parameter ? SetWording.value(parameter, value) : SetWording.number(value);
  }

  /** "scene Chorus", or "scene 2" when it has no name. */
  scene(ref: SceneRef): string {
    if ("name" in ref) return `scene ${ref.name}`;
    const name = this.set?.song.scenes[ref.index]?.name;
    return `scene ${name || ref.index + 1}`;
  }

  /** "locator Chorus", or "the locator at bar 9" when it has no name. */
  locator(ref: LocatorRef): string {
    if ("name" in ref) return `locator ${ref.name}`;
    const locators = this.set?.song.locators ?? [];
    const found = "index" in ref ? locators[ref.index] : locators.find((locator) => Math.abs(locator.time - ref.time) <= BEAT_TOLERANCE);
    if (found?.name) return `locator ${found.name}`;
    if (found) return `the locator at ${this.position(found.time)}`;
    return "index" in ref ? `locator ${ref.index + 1}` : `the locator at ${this.position(ref.time)}`;
  }

  /** "bar 9" in the Set's time signature, or "beat 32" before the first snapshot. */
  position(beat: number): string {
    return this.beatsPerBar ? `bar ${SetWording.bar(beat, this.beatsPerBar)}` : `beat ${SetWording.beat(beat)}`;
  }

  /** "bars 9–16", or "beats 32–64" before the first snapshot. */
  span(start: number, end: number): string {
    return this.beatsPerBar ? SetWording.bars(start, end, this.beatsPerBar) : `beats ${SetWording.beat(start)}–${SetWording.beat(end)}`;
  }

  /** "4 bars", or "16 beats" before the first snapshot. */
  length(beats: number): string {
    if (!this.beatsPerBar) return `${SetWording.number(beats)} ${beats === 1 ? "beat" : "beats"}`;
    const bars = beats / this.beatsPerBar;
    return `${SetWording.number(bars)} ${bars === 1 ? "bar" : "bars"}`;
  }

  /** "Lyrics · lines 3–4": the lines a save changes, when the snapshot holds the revision it was edited from. */
  lyrics(text: string, baseRevision: number): string {
    const sheet = this.set?.sheet;
    const after = LyricsText.normalize(text);
    if (!sheet || sheet.lyricsRevision !== baseRevision || sheet.lyrics === after) return "Lyrics";
    return LyricsWording.label(sheet.lyrics, after);
  }

  private findTrack(ref: TrackRef): TrackSnapshot | undefined {
    const set = this.set;
    if (!set) return undefined;
    if ("main" in ref) return set.main;
    if ("index" in ref) return set.tracks[ref.index];
    if ("returnIndex" in ref) return set.returnTracks[ref.returnIndex];
    const every = [...set.tracks, ...set.returnTracks, set.main];
    if ("tag" in ref) {
      const tag = ref.tag;
      return every.find((track) => track.tag === tag);
    }
    const name = ref.name;
    const lower = name.toLowerCase();
    return (
      every.find((track) => track.name === name || SetWording.name(track) === name) ??
      every.find((track) => track.name.toLowerCase() === lower || SetWording.name(track).toLowerCase() === lower)
    );
  }

  /** A track's Arrangement clips, then the clips on its take lanes. */
  private static clipsOf(track: TrackSnapshot): ClipInfo[] {
    return [...track.arrangementClips, ...track.takeLanes.flatMap((lane) => lane.clips)];
  }

  private taggedClip(tag: string): string {
    const set = this.set;
    for (const track of set ? [...set.tracks, ...set.returnTracks] : []) {
      const clips = [...track.clipSlots.flatMap((slot) => (slot.clip ? [slot.clip] : [])), ...RefNames.clipsOf(track)];
      const clip = clips.find((candidate) => candidate.tag === tag);
      if (!clip) continue;
      const name = SetWording.name(clip);
      return [SetWording.name(track) || `track ${track.index + 1}`, name ? `clip ${name}` : "clip"].join(SEPARATOR);
    }
    return `the clip tagged ${tag}`;
  }

  /** The racks and chains on the way to a device, by name where the snapshot has them, and the device. */
  private findDevice(ref: DeviceRef): FoundDevice {
    const path = ref.chain ?? [];
    const parts: string[] = [];
    let devices: DeviceSnapshot[] | undefined = this.findTrack(ref.track)?.devices;
    for (let step = 0; step + 1 < path.length; step += 2) {
      const rackIndex = path[step] ?? 0;
      const chainIndex = path[step + 1] ?? 0;
      const rack = devices?.[rackIndex];
      const chain = rack?.chains?.[chainIndex];
      parts.push(rack?.name ?? `rack ${rackIndex + 1}`);
      parts.push(chain?.receivingNote === undefined ? `chain ${chainIndex + 1}` : `pad ${noteName(chain.receivingNote)}`);
      devices = chain?.devices;
    }
    return { parts, device: ref.index === MIXER_INDEX ? undefined : devices?.[ref.index] };
  }

  /** A mixer's parameters are named after the track or chain they belong to: "Bass · volume". */
  private mixerPlace(ref: DeviceRef): string {
    return [this.track(ref.track), ...this.findDevice(ref).parts].join(SEPARATOR);
  }

  private parameterName(ref: ParameterRef): string {
    if (typeof ref.parameter === "string") return ref.parameter;
    if (ref.device.index === MIXER_INDEX) {
      if (ref.parameter === VOLUME_PARAMETER) return "volume";
      if (ref.parameter === PAN_PARAMETER) return "pan";
      const send = ref.parameter - FIRST_SEND_PARAMETER;
      const returnTrack = this.set?.returnTracks[send];
      return `send ${returnTrack ? SetWording.name(returnTrack) : send + 1}`;
    }
    return this.findParameter(ref)?.name ?? `parameter ${ref.parameter + 1}`;
  }

  private findParameter(ref: ParameterRef): ParameterInfo | undefined {
    const byName = (parameters: readonly ParameterInfo[]) =>
      typeof ref.parameter === "string" ? parameters.find((parameter) => parameter.name === ref.parameter) : parameters[ref.parameter];
    if (ref.device.index !== MIXER_INDEX) return byName(this.findDevice(ref.device).device?.parameters ?? []);
    const mixer = this.findTrack(ref.device.track)?.mixer;
    if (!mixer || (ref.device.chain ?? []).length > 0) return undefined;
    return byName([mixer.volume, mixer.panning, ...mixer.sends]);
  }
}
