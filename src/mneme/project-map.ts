import type { AudioClipInfo, ClipInfo, ParameterInfo, SceneInfo, TrackKind } from "../shared/live-ops";
import { noteName } from "../shared/notes";
import type { ChainSnapshot, DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { SetChange } from "../shared/versions";
import { DEVICE_ON, SetWording } from "./set-diff";

/** Which parameter values a device shows. */
enum ParameterDetail {
  /** Every value that isn't the parameter's default. */
  All = "all",
  /** Those of the parameters that say most about the sound. */
  Telling = "telling",
  None = "none",
}

/** How much each clip shows. */
enum ClipDetail {
  /** Where it is, its name, length, notes and pitch range or audio file. */
  Full = "full",
  /** Where it is and its name. */
  Names = "names",
  /** A count per track. */
  Counts = "counts",
}

interface Detail {
  parameters: ParameterDetail;
  clips: ClipDetail;
  /** The devices inside racks, chain by chain (otherwise a count of chains). */
  racks: boolean;
  /** Device names, sends and scene names (otherwise counts). */
  names: boolean;
  /** Each track as one line with its name, kind, group, mute, solo and arm, and nothing else. */
  bare: boolean;
}

/** From the full map to the barest: parameter values go first, then clip details; every track keeps its line. */
const LEVELS: readonly Detail[] = [
  { parameters: ParameterDetail.All, clips: ClipDetail.Full, racks: true, names: true, bare: false },
  { parameters: ParameterDetail.Telling, clips: ClipDetail.Full, racks: true, names: true, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Full, racks: true, names: true, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Names, racks: true, names: true, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Counts, racks: true, names: true, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Counts, racks: false, names: true, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Counts, racks: false, names: false, bare: false },
  { parameters: ParameterDetail.None, clips: ClipDetail.Counts, racks: false, names: false, bare: true },
];

/** Words in the names of the parameters that say most about a sound: filter, EQ, dynamics, drive, space, level, macros. */
const TELLING_PARAMETER_WORDS = [
  "freq",
  "cutoff",
  "res",
  "gain",
  "drive",
  "threshold",
  "ratio",
  "attack",
  "decay",
  "release",
  "dry/wet",
  "feedback",
  "volume",
  "macro",
];

const LEFT_OUT = "Some detail is left out to keep this short; every detail can be read with the read tools.";

const KIND_WORDS: Readonly<Record<TrackKind, string>> = { midi: "MIDI", audio: "audio", group: "group", return: "return", main: "main" };

/** The compact map of the whole project that the agent reads on every request. */
export class ProjectMap {
  /** The map within maxChars: detail goes before structure, and a last line says that something was left out. */
  static encode(snapshot: SetSnapshot, maxChars: number): string {
    const writer = new MapWriter(snapshot);
    let text = "";
    for (const [level, detail] of LEVELS.entries()) {
      text = writer.write(detail);
      if (level === 0 && text.length <= maxChars) return text;
      const shortened = `${text}\n${LEFT_OUT}`;
      if (shortened.length <= maxChars) return shortened;
    }
    // Even one line per track is too long: keep the whole lines that fit, and still end with the line.
    const kept = text.slice(0, Math.max(0, maxChars - LEFT_OUT.length - 1));
    return `${kept.slice(0, Math.max(0, kept.lastIndexOf("\n")))}\n${LEFT_OUT}`;
  }

  /** One change label per line. */
  static describeChanges(changes: SetChange[]): string {
    return changes.map((change) => change.label).join("\n");
  }
}

/** Writes the map of one snapshot at one level of detail. */
class MapWriter {
  private readonly beatsPerBar: number;

  constructor(private readonly set: SetSnapshot) {
    this.beatsPerBar = SetWording.beatsPerBar(set.signature);
  }

  write(detail: Detail): string {
    const { tracks, returnTracks, main } = this.set;
    const lines = [this.songLine()];
    lines.push(tracks.length > 0 ? "Tracks (indexes count from 0, as in the tools; bars count from 1):" : "Tracks: none");
    tracks.forEach((track, index) => lines.push(...this.trackLines(`${index} ${SetWording.name(track)}`, track, detail, true)));
    if (returnTracks.length > 0) lines.push("Return tracks:");
    returnTracks.forEach((track, index) => lines.push(...this.trackLines(`${index} ${SetWording.name(track)}`, track, detail, false)));
    lines.push(...this.trackLines("Main track", main, detail, false), this.scenesLine(detail), this.locatorsLine());
    return lines.filter((line) => line.length > 0).join("\n");
  }

  /** Tempo, time signature, key and scale. */
  private songLine(): string {
    const { song, signature } = this.set;
    const key = `${SetWording.key(song.rootNote, song.scaleName)}${song.scaleMode ? " (Scale Mode on)" : ""}`;
    return `Song: ${SetWording.tempo(song.tempo)} BPM · ${SetWording.signature(signature)} · ${key}`;
  }

  private trackLines(title: string, track: TrackSnapshot, detail: Detail, regular: boolean): string[] {
    const lines = [`${title}: ${this.trackState(track, detail, regular)}`];
    if (detail.bare) return lines;
    const devices = this.devices(track.devices, detail);
    if (devices) lines.push(`  devices: ${devices}`);
    const clips = this.clips(track, detail);
    if (clips) lines.push(`  clips: ${clips}`);
    return lines;
  }

  /** "MIDI · in Drums · muted · vol 0.85 · pan 0 · sends A-Reverb 0.3". */
  private trackState(track: TrackSnapshot, detail: Detail, regular: boolean): string {
    const parts: string[] = [];
    if (regular) parts.push(KIND_WORDS[track.kind]);
    const group = track.groupTrack === null ? undefined : this.set.tracks[track.groupTrack];
    if (group) parts.push(`in ${SetWording.name(group)}`);
    if (track.mute) parts.push("muted");
    else if (track.mutedViaSolo) parts.push("muted by solo");
    if (track.solo) parts.push("soloed");
    if (track.arm) parts.push("armed");
    if (detail.bare) return parts.join(" · ");
    const { volume, panning, sends } = track.mixer;
    if (typeof volume.value === "number") parts.push(`vol ${SetWording.number(volume.value)}`);
    if (typeof panning.value === "number") parts.push(`pan ${SetWording.number(panning.value)}`);
    if (detail.names) {
      const active = sends.flatMap((send, index) =>
        typeof send.value === "number" && send.value > send.min ? [`${this.returnName(index, send)} ${SetWording.number(send.value)}`] : [],
      );
      if (active.length > 0) parts.push(`sends ${active.join(", ")}`);
    }
    return parts.join(" · ");
  }

  private returnName(index: number, send: ParameterInfo): string {
    const returnTrack = this.set.returnTracks[index];
    return returnTrack ? SetWording.name(returnTrack) : send.name;
  }

  /** Devices in signal order, "Operator → EQ Eight", or how many there are. */
  private devices(devices: readonly DeviceSnapshot[], detail: Detail): string {
    if (devices.length === 0) return "";
    if (!detail.names) return `${devices.length}`;
    return devices.map((device) => this.device(device, detail)).join(" → ");
  }

  /** "EQ Eight off (1 Frequency A 120)", "Drum Rack [C1: Simpler (Kick.wav) | D1: empty]". */
  private device(device: DeviceSnapshot, detail: Detail): string {
    const facts = [SetWording.fileName(device.sample), ...this.parameters(device, detail.parameters)].filter((fact) => fact.length > 0);
    const text = `${device.name}${SetWording.isOff(device) ? " off" : ""}${facts.length > 0 ? ` (${facts.join(", ")})` : ""}`;
    const chains = device.chains ?? [];
    if (chains.length === 0) return text;
    if (!detail.racks) {
      const pads = chains.some((chain) => chain.receivingNote !== undefined);
      return `${text} [${SetWording.count(chains.length, pads ? "pad" : "chain")}]`;
    }
    return `${text} [${chains.map((chain, index) => this.chain(chain, index, detail)).join(" | ")}]`;
  }

  /** A Drum Rack pad by its note, any other chain by its index. */
  private chain(chain: ChainSnapshot, index: number, detail: Detail): string {
    const name = chain.receivingNote === undefined ? `${index}` : noteName(chain.receivingNote);
    const devices = chain.devices.map((device) => this.device(device, detail)).join(" → ");
    return `${name}: ${devices || "empty"}`;
  }

  private parameters(device: DeviceSnapshot, level: ParameterDetail): string[] {
    if (level === ParameterDetail.None) return [];
    return device.parameters
      .filter((parameter) => MapWriter.shows(parameter, level))
      .map((parameter) => `${parameter.name} ${SetWording.value(parameter, parameter.value ?? parameter.defaultValue)}`);
  }

  /** A value away from its default says something; the telling level keeps only the parameters that say most. */
  private static shows(parameter: ParameterInfo, level: ParameterDetail): boolean {
    if (typeof parameter.value !== "number" || parameter.value === parameter.defaultValue || parameter.name === DEVICE_ON) return false;
    if (level === ParameterDetail.All) return true;
    const name = parameter.name.toLowerCase();
    return TELLING_PARAMETER_WORDS.some((word) => name.includes(word));
  }

  private clips(track: TrackSnapshot, detail: Detail): string {
    const arrangement = track.arrangementClips;
    const lanes = track.takeLanes.flatMap((lane, index) => lane.clips.map((clip) => ({ index, clip })));
    const session = track.clipSlots.flatMap((slot, index) => (slot.clip ? [{ index, clip: slot.clip }] : []));
    if (detail.clips === ClipDetail.Counts) return this.clipCounts(arrangement, lanes.length, session.length);
    return [
      ...arrangement.map((clip) => this.clip(SetWording.bars(clip.startTime, clip.endTime, this.beatsPerBar), clip, detail, false)),
      ...lanes.map(({ index, clip }) => {
        const where = `take lane ${index} ${SetWording.bars(clip.startTime, clip.endTime, this.beatsPerBar)}`;
        return this.clip(where, clip, detail, false);
      }),
      ...session.map(({ index, clip }) => this.clip(`slot ${index}`, clip, detail, true)),
    ].join(" · ");
  }

  /** "12 clips in bars 1–64 · 3 clips on take lanes · 4 clips in slots". */
  private clipCounts(arrangement: readonly ClipInfo[], onLanes: number, inSlots: number): string {
    const parts: string[] = [];
    if (arrangement.length > 0) {
      const start = Math.min(...arrangement.map((clip) => clip.startTime));
      const end = Math.max(...arrangement.map((clip) => clip.endTime));
      parts.push(`${SetWording.count(arrangement.length, "clip")} in ${SetWording.bars(start, end, this.beatsPerBar)}`);
    }
    if (onLanes > 0) parts.push(`${SetWording.count(onLanes, "clip")} on take lanes`);
    if (inSlots > 0) parts.push(`${SetWording.count(inSlots, "clip")} in slots`);
    return parts.join(" · ");
  }

  /** "bars 9–16 Bass A (32 notes C1–G2, starts at beat 32)", "slot 2 Fill (1 bar, 12 notes C1–F#1)". */
  private clip(where: string, clip: ClipInfo, detail: Detail, inSlot: boolean): string {
    const name = SetWording.name(clip);
    const facts: string[] = clip.muted ? ["deactivated"] : [];
    if (detail.clips === ClipDetail.Full) {
      if (inSlot) {
        const bars = clip.duration / this.beatsPerBar;
        facts.push(`${SetWording.number(bars)} ${bars === 1 ? "bar" : "bars"}`);
      }
      facts.push(clip.kind === "midi" ? MapWriter.notes(clip) : SetWording.fileName((clip as AudioClipInfo).filePath) || "audio");
      if (!inSlot) facts.push(`starts at beat ${SetWording.beat(clip.startTime)}`);
    }
    return `${where}${name ? ` ${name}` : ""}${facts.length > 0 ? ` (${facts.join(", ")})` : ""}`;
  }

  /** "32 notes C1–G2", or "no notes". */
  private static notes(clip: ClipInfo): string {
    const notes = clip.notes ?? [];
    return notes.length > 0 ? `${SetWording.count(notes.length, "note")} ${SetWording.pitchRange(notes)}` : "no notes";
  }

  private scenesLine(detail: Detail): string {
    const { scenes } = this.set.song;
    if (scenes.length === 0) return "";
    if (!detail.names) return `Scenes: ${scenes.length}`;
    return `Scenes: ${scenes.map((scene, index) => this.scene(scene, index)).join(" · ")}`;
  }

  /** "2 Chorus (128 BPM, 3/4)": a tempo and time signature only when the scene sets its own. */
  private scene(scene: SceneInfo, index: number): string {
    const { song, signature } = this.set;
    const facts: string[] = [];
    if (scene.tempo > 0 && scene.tempo !== song.tempo) facts.push(`${SetWording.tempo(scene.tempo)} BPM`);
    const ownSignature =
      scene.signatureNumerator > 0 &&
      (scene.signatureNumerator !== signature.numerator || scene.signatureDenominator !== signature.denominator);
    if (ownSignature) facts.push(`${scene.signatureNumerator}/${scene.signatureDenominator}`);
    return `${index}${scene.name ? ` ${scene.name}` : ""}${facts.length > 0 ? ` (${facts.join(", ")})` : ""}`;
  }

  private locatorsLine(): string {
    const { locators } = this.set.song;
    if (locators.length === 0) return "";
    const items = locators.map((locator) => `${locator.name || "(no name)"} at bar ${SetWording.bar(locator.time, this.beatsPerBar)}`);
    return `Locators: ${items.join(" · ")}`;
  }
}
