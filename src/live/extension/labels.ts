import { DrumRack, MidiClip, RackDevice, Simpler, type Clip, type Device, type TakeLane, type Track } from "@ableton-extensions/sdk";
import type { TrackKind } from "../../shared/live-ops";
import type { Version } from "./sdk";
import { TaggedName } from "./tags";
import type { TrackDirectory } from "./track-directory";

const TRACK_KIND_WORDS: Readonly<Record<TrackKind, string>> = {
  midi: "MIDI track",
  audio: "audio track",
  group: "group track",
  return: "return track",
  main: "main track",
};

/** Plain words for Live objects, numbered the way musicians count: track 1 is the first track. */
export class Labels {
  constructor(private readonly tracks: TrackDirectory) {}

  /** 'track 3 "Keys"', or 'MIDI track 3 "Keys"' with its kind; 'return track "A-Reverb"'; 'the main track'. */
  track(track: Track<Version>, withKind = false): string {
    const position = this.tracks.position(track);
    const name = Labels.quoted(TaggedName.parse(track.name).name);
    if (position.kind === "main") return "the main track";
    if (position.kind === "return") return `${TRACK_KIND_WORDS.return}${name}`;
    return `${withKind ? TRACK_KIND_WORDS[position.kind] : "track"} ${position.index + 1}${name}`;
  }

  /** 'MIDI clip "Verse melody"' or 'audio clip'. */
  clip(clip: Clip<Version>): string {
    return `${clip instanceof MidiClip ? "MIDI" : "audio"} clip${Labels.quoted(TaggedName.parse(clip.name).name)}`;
  }

  takeLane(lane: TakeLane<Version>, index: number, track: Track<Version>): string {
    return `take lane ${index + 1}${Labels.quoted(lane.name)} of ${this.track(track)}`;
  }

  /** 'Simpler "Kick"', 'Drum Rack "808 Kit"', or just 'Simpler' when it has Live's default name. */
  device(device: Device<Version>): string {
    const kind = Labels.deviceKind(device);
    const name = device.name;
    return name && name !== kind ? `${kind} "${name}"` : kind;
  }

  static beats(start: number, end: number): string {
    return `beats ${Labels.beat(start)}–${Labels.beat(end)}`;
  }

  /** "a", "a and b", "a, b and c". */
  static list(items: readonly string[]): string {
    if (items.length < 2) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /** ' "name"' after a word, or nothing for an empty name. */
  static quoted(name: string): string {
    return name ? ` "${name}"` : "";
  }

  private static beat(value: number): string {
    return String(Number(value.toFixed(3)));
  }

  private static deviceKind(device: Device<Version>): string {
    if (device instanceof Simpler) return "Simpler";
    if (device instanceof DrumRack) return "Drum Rack";
    if (device instanceof RackDevice) return "rack";
    return "device";
  }
}
