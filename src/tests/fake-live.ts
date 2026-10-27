import { MidiClip, MidiTrack } from "@ableton-extensions/sdk";
import { LiveSet } from "../live/extension/live-set";
import type { Live } from "../live/extension/sdk";

export interface FakeClip {
  name: string;
  startTime: number;
}

export interface FakeTrack {
  name: string;
  arrangementClips: FakeClip[];
}

/**
 * A Live Set for tests, built from the SDK's own classes with plain data, so the extension's
 * `instanceof` checks behave as they do in Live. The musician's edits are made by changing fields.
 */
export class FakeLive {
  private readonly tracks: FakeTrack[] = [];
  private nextId = 1n;

  midiTrack(name: string, arrangementClips: FakeClip[] = []): FakeTrack {
    const track = this.create<FakeTrack>(MidiTrack.prototype, { name, arrangementClips, clipSlots: [], takeLanes: [], groupTrack: null });
    this.tracks.push(track);
    return track;
  }

  midiClip(name: string, startTime: number): FakeClip {
    return this.create<FakeClip>(MidiClip.prototype, { name, startTime });
  }

  liveSet(): LiveSet {
    const mainTrack = this.create(Object.prototype, { name: "Main", devices: [] });
    const song = { tracks: this.tracks, returnTracks: [], mainTrack, scenes: [], cuePoints: [] };
    return new LiveSet({ application: { song } } as unknown as Live);
  }

  /** An object of an SDK class with writable data fields and a handle, like the objects Live hands out. */
  private create<T>(prototype: object, fields: Record<string, unknown>): T {
    const all = { ...fields, handle: { id: this.nextId++ } };
    const properties = Object.fromEntries(
      Object.entries(all).map(([key, value]) => [key, { value, writable: true, enumerable: true }]),
    );
    return Object.create(prototype, properties) as T;
  }
}
