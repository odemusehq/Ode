import type { ClipInfo, ParameterInfo } from "../shared/live-ops";
import type { Note } from "../shared/live";
import type { DeviceSnapshot, SetContents, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import { LeadSheetSchema, type LeadSheet } from "../shared/song";

/** Builders for small, known Sets used by the version and restore tests. */
export class TestSets {
  /** Drums, bass and pad in A minor at 120 BPM, with a reverb return; the bass clip is selected. */
  static small(): SetSnapshot {
    return {
      takenAt: "2026-10-28T00:00:00.000Z",
      song: {
        tempo: 120,
        gridQuantization: 4,
        gridIsTriplet: false,
        rootNote: 9,
        scaleName: "Minor",
        scaleMode: true,
        scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
        scenes: [{ index: 0, name: "Verse", tempo: 120, signatureNumerator: 4, signatureDenominator: 4 }],
        locators: [
          { index: 0, name: "Verse", time: 0 },
          { index: 1, name: "Chorus", time: 32 },
        ],
      },
      tracks: [
        TestSets.track(0, "Drums", [TestSets.device(0, "Drum Rack", "DrumGroupDevice", [TestSets.parameter(0, "Macro 1", 0, 127, 0)], true)], [
          TestSets.clip(0, "Beat", 0, 16, [36, 38, 36, 38].map((pitch, beat) => ({ pitch, start: beat, duration: 0.25, velocity: 100 }))),
        ]),
        TestSets.track(1, "Bass", [TestSets.device(0, "Operator", "Operator", [TestSets.parameter(0, "Filter Freq", 20, 20000, 800), TestSets.parameter(1, "Volume", 0, 1, 0.7)])], [
          TestSets.clip(1, "Bass A", 0, 16, [45, 45, 48, 43].map((pitch, bar) => ({ pitch, start: bar * 4, duration: 1, velocity: 96 }))),
        ]),
        TestSets.track(2, "Pad", [
          TestSets.device(0, "Wavetable", "InstrumentVector", [TestSets.parameter(0, "Filter 1 Freq", 20, 20000, 2400)]),
          TestSets.device(1, "EQ Eight", "Eq8", [TestSets.parameter(0, "1 Frequency A", 30, 22000, 120), TestSets.parameter(1, "1 Gain A", -15, 15, 0)]),
        ], [TestSets.clip(2, "Pad chords", 0, 16, [57, 60, 64].map((pitch) => ({ pitch, start: 0, duration: 16, velocity: 80 })))]),
      ],
      returnTracks: [{ ...TestSets.track(0, "A-Reverb", [TestSets.device(0, "Reverb", "Reverb", [TestSets.parameter(0, "Decay Time", 200, 60000, 2500)])], []), kind: "return" }],
      main: { ...TestSets.track(0, "Main", [TestSets.device(0, "Limiter", "Limiter", [TestSets.parameter(0, "Ceiling", -24, 0, -1)])], []), kind: "main" },
      transport: { playing: false, time: 0, loop: { on: false, start: 0, length: 16 }, signature: { numerator: 4, denominator: 4 } },
      selection: { track: { index: 1 }, clip: { track: { index: 1 }, start: 0 }, scene: null, time: 0, isPlaying: false },
    };
  }

  /** A Set with many tracks and notes, for size limits. */
  static large(trackCount: number, notesPerClip: number): SetSnapshot {
    const set = TestSets.small();
    set.tracks = Array.from({ length: trackCount }, (_, index) =>
      TestSets.track(index, `Track ${index + 1}`, [TestSets.device(0, "Operator", "Operator", [TestSets.parameter(0, "Filter Freq", 20, 20000, 800)])], [
        TestSets.clip(index, `Clip ${index + 1}`, 0, 64, Array.from({ length: notesPerClip }, (__, n) => ({ pitch: 48 + (n % 24), start: (n * 64) / notesPerClip, duration: 0.25, velocity: 90 }))),
      ]),
    );
    return set;
  }

  /** A lead sheet with one verse of two lines over the first 16 beats. */
  static sheet(): LeadSheet {
    return LeadSheetSchema.parse({
      title: "Night Bus",
      sections: [
        {
          id: "verse-1",
          kind: "verse",
          name: "Verse 1",
          startBeat: 0,
          lengthBeats: 16,
          lines: [
            { id: "v1-l1", text: "The last bus leaves at midnight" },
            { id: "v1-l2", text: "I count the windows going by" },
          ],
          chords: [{ beat: 0, lengthBeats: 16, symbol: "Am" }],
        },
      ],
    });
  }

  /** What a version keeps: the Set without the time it was read, the playhead or the selection. */
  static contents(set: SetSnapshot): SetContents & { signature: SetSnapshot["transport"]["signature"] } {
    const { song, tracks, returnTracks, main, transport } = set;
    return structuredClone({ song, tracks, returnTracks, main, signature: transport.signature });
  }

  /** Live's own devices as the fake Set inserts them, with values a restore has to set back. */
  static liveDevices(): Record<string, DeviceSnapshot> {
    return {
      "EQ Eight": TestSets.device(0, "EQ Eight", "Eq8", [
        { ...TestSets.parameter(0, "1 Frequency A", 30, 22000, 120), value: 1000 },
        { ...TestSets.parameter(1, "1 Gain A", -15, 15, 0), value: 3 },
      ]),
      Utility: TestSets.device(0, "Utility", "StereoGain", [TestSets.parameter(0, "Gain", -35, 35, 0)]),
      Compressor: TestSets.device(0, "Compressor", "Compressor2", [TestSets.parameter(0, "Threshold", -60, 0, 0), TestSets.parameter(1, "Ratio", 1, 100, 4)]),
      "Glue Compressor": TestSets.device(0, "Glue Compressor", "GlueCompressor", [TestSets.parameter(0, "Threshold", -40, 0, 0), TestSets.parameter(1, "Makeup", 0, 20, 0)]),
      Saturator: TestSets.device(0, "Saturator", "Saturator", [TestSets.parameter(0, "Drive", -36, 36, 0), TestSets.parameter(1, "Dry/Wet", 0, 1, 1)]),
      Limiter: TestSets.device(0, "Limiter", "Limiter", [TestSets.parameter(0, "Ceiling", -24, 0, -0.3), TestSets.parameter(1, "Gain", 0, 24, 0)]),
      Reverb: TestSets.device(0, "Reverb", "Reverb", [TestSets.parameter(0, "Decay Time", 200, 60000, 2500), TestSets.parameter(1, "Dry/Wet", 0, 1, 0.3)]),
      "Auto Filter": TestSets.device(0, "Auto Filter", "AutoFilter", [TestSets.parameter(0, "Frequency", 20, 20000, 20000), TestSets.parameter(1, "Resonance", 0, 1, 0.1)]),
    };
  }

  /** The item at `index`; a test Set that lacks it is a mistake in the test. */
  static at<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) throw new Error(`The test Set has no item at ${index}`);
    return item;
  }

  static track(index: number, name: string, devices: DeviceSnapshot[], clips: ClipInfo[]): TrackSnapshot {
    return {
      index,
      name,
      kind: "midi",
      color: 0,
      mute: false,
      solo: false,
      arm: false,
      mutedViaSolo: false,
      groupTrack: null,
      clipSlots: [],
      arrangementClips: clips,
      takeLanes: [],
      mixer: {
        volume: TestSets.parameter(0, "Track Volume", 0, 1, 0.85),
        panning: TestSets.parameter(1, "Track Panning", -1, 1, 0),
        sends: [TestSets.parameter(2, "Send A", 0, 1, 0)],
      },
      devices,
    };
  }

  static device(index: number, name: string, className: string, parameters: ParameterInfo[], isRack = false): DeviceSnapshot {
    return { index, name, className, isRack, parameters, ...(isRack ? { chains: [{ index: 0, receivingNote: 36, devices: [] }] } : {}) };
  }

  static clip(trackIndex: number, name: string, start: number, length: number, notes: Note[]): ClipInfo {
    return {
      ref: { track: { index: trackIndex }, start },
      kind: "midi",
      name,
      color: 0,
      muted: false,
      startTime: start,
      endTime: start + length,
      duration: length,
      startMarker: 0,
      endMarker: length,
      looping: false,
      loopStart: 0,
      loopEnd: length,
      notes,
    };
  }

  static parameter(index: number, name: string, min: number, max: number, value: number): ParameterInfo {
    return { index, name, min, max, isQuantized: false, defaultValue: value, valueItems: [], value };
  }
}
