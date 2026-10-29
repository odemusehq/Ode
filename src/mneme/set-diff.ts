import { basename } from "node:path";
import { diffIndices } from "node-diff3";
import { MIXER_INDEX, TAG_SEPARATOR, type Note, type TrackRef } from "../shared/live";
import type { AudioClipInfo, ClipInfo, LocatorInfo, MixerInfo, ParameterInfo, SceneInfo, TimeSignature } from "../shared/live-ops";
import { NOTE_NAMES, noteName } from "../shared/notes";
import type { ChainSnapshot, DeviceSnapshot, SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { LeadSheet, Section } from "../shared/song";
import {
  ChangeKind,
  TrackList,
  type ChangeTarget,
  type ClipField,
  type ClipKey,
  type DeviceField,
  type SetChange,
  type SheetDetails,
  type TrackField,
  type TrackKey,
} from "../shared/versions";
import { LyricsText } from "./lyrics-text";

/** A whole note is four quarter-note beats, so a bar holds numerator × 4 / denominator beats. */
const QUARTER_NOTES_PER_WHOLE_NOTE = 4;
/** The mixer's parameters, numbered as in DeviceRef: volume, pan, then one send per return track. */
const VOLUME_PARAMETER = 0;
const PAN_PARAMETER = 1;
const FIRST_SEND_PARAMETER = 2;
/** Live's send range, from silent to full, for a new send whose details are unknown. */
const SEND_MIN = 0;
const SEND_MAX = 1;
/** Live shows pan from 50L to 50R. */
const PAN_DISPLAY_RANGE = 50;
/** Live's warp modes by number. */
const WARP_MODES: Readonly<Record<number, string>> = {
  0: "Beats",
  1: "Tones",
  2: "Texture",
  3: "Re-Pitch",
  4: "Complex",
  5: "REX",
  6: "Complex Pro",
};
/** A summary names at most this many tracks and counts the rest. */
const SUMMARY_TRACK_NAMES = 3;
/** The lead sheet's details in plain words; the title is named with its old and new words. */
const SHEET_DETAIL_WORDS: ReadonlyArray<readonly [Exclude<keyof SheetDetails, "title">, string]> = [
  ["intent", "what the song is about"],
  ["links", "clip links"],
  ["locked", "locked parts"],
  ["credits", "credits"],
  ["notes", "notes"],
];

/** The switch every Live device has for turning it on and off. */
export const DEVICE_ON = "Device On";

/** The value of a song key change. */
export interface SongKey {
  rootNote: number;
  scaleName: string;
  scaleMode: boolean;
  scaleIntervals: number[];
}

/** The value of a clip loop change: its loop, markers and length, and in the Arrangement where it ends. */
export interface ClipLoop {
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  startMarker: number;
  endMarker: number;
  duration: number;
  endTime?: number;
}

/** The value of an audio clip change. */
export interface ClipAudio {
  filePath: string;
  warping: boolean;
  warpMode: number;
  warpMarkers: AudioClipInfo["warpMarkers"];
}

type DeviceTarget = Extract<ChangeTarget, { scope: "device" }>;

/** A device that is in both snapshots: its chain path and index in each. */
interface DevicePlace {
  from: readonly number[];
  to: readonly number[];
  fromIndex: number;
  toIndex: number;
}

/** Plain words for what is in the Set, shared by change labels and the project map. */
export class SetWording {
  /** Quarter-note beats in one bar. */
  static beatsPerBar(signature: TimeSignature | null): number | null {
    if (!signature || !(signature.numerator > 0 && signature.denominator > 0)) return null;
    return (signature.numerator * QUARTER_NOTES_PER_WHOLE_NOTE) / signature.denominator;
  }

  /** The bar a beat falls in; bars count from 1. */
  static bar(beat: number, beatsPerBar: number): number {
    return Math.floor(beat / beatsPerBar) + 1;
  }

  /** "9–16" for the bars from `start` up to `end` (exclusive), or "9" when they stay in one bar. */
  static barSpan(start: number, end: number, beatsPerBar: number | null): string {
    if (beatsPerBar === null) return `${SetWording.number(start)}–${SetWording.number(end)}`;
    const first = SetWording.bar(start, beatsPerBar);
    const last = Math.max(first, Math.ceil(end / beatsPerBar));
    return first === last ? `${first}` : `${first}–${last}`;
  }

  /** "bars 9–16" or "bar 9". */
  static bars(start: number, end: number, beatsPerBar: number | null): string {
    const span = SetWording.barSpan(start, end, beatsPerBar);
    if (beatsPerBar === null) return `beats ${span}`;
    return span.includes("–") ? `bars ${span}` : `bar ${span}`;
  }

  /** "A minor", "C major", "D Dorian". */
  static key(rootNote: number, scaleName: string): string {
    const pitchClasses = NOTE_NAMES.length;
    const root = NOTE_NAMES[((rootNote % pitchClasses) + pitchClasses) % pitchClasses] ?? "";
    const scale = /^(major|minor)$/i.test(scaleName) ? scaleName.toLowerCase() : scaleName;
    return `${root} ${scale}`.trim();
  }

  /** "4/4". */
  static signature(signature: TimeSignature | null): string {
    return signature ? `${signature.numerator}/${signature.denominator}` : "meter unknown (SDK cannot read Song meter)";
  }

  static position(beat: number, beatsPerBar: number | null): string {
    return beatsPerBar === null ? `beat ${SetWording.number(beat)}` : `bar ${SetWording.bar(beat, beatsPerBar)}`;
  }

  /** A number as short as it stays readable: 2400, 12.5, 0.85. */
  static number(value: number): string {
    const size = Math.abs(value);
    return String(Number(value.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)));
  }

  /** A tempo in BPM: 124, 123.5. */
  static tempo(value: number): string {
    return String(Number(value.toFixed(2)));
  }

  /** A position in beats: 32, 32.25. */
  static beat(value: number): string {
    return String(Number(value.toFixed(3)));
  }

  /** A parameter's value: the value's name when the parameter is quantized ("Lowpass"), otherwise the number. */
  static value(parameter: ParameterInfo, value: number): string {
    const item = parameter.isQuantized ? parameter.valueItems[Math.round(value)] : undefined;
    return item ?? SetWording.number(value);
  }

  /** Pan as Live shows it: "C", "25L", "50R". */
  static pan(value: number): string {
    const amount = Math.round(Math.abs(value) * PAN_DISPLAY_RANGE);
    return amount === 0 ? "C" : `${amount}${value < 0 ? "L" : "R"}`;
  }

  /** "C1–G2", or one note name when every note has the same pitch. */
  static pitchRange(notes: readonly Note[]): string {
    let low = Infinity;
    let high = -Infinity;
    for (const note of notes) {
      low = Math.min(low, note.pitch);
      high = Math.max(high, note.pitch);
    }
    if (low > high) return "";
    return low === high ? noteName(low) : `${noteName(low)}–${noteName(high)}`;
  }

  /** The file name of a path, or "" for a missing path. */
  static fileName(path: string | null | undefined): string {
    return path ? basename(path) : "";
  }

  static warpMode(mode: number): string {
    return WARP_MODES[mode] ?? `mode ${mode}`;
  }

  /** A name without Ode's tag, for a name that still carries it. */
  static name(item: { name: string; tag?: string }): string {
    const suffix = item.tag ? `${TAG_SEPARATOR}${item.tag}` : "";
    return suffix && item.name.endsWith(suffix) ? item.name.slice(0, -suffix.length) : item.name;
  }

  /** "1 clip", "3 clips". */
  static count(amount: number, noun: string): string {
    return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
  }

  /** "a", "a and b", "a, b and c". */
  static list(items: readonly string[]): string {
    if (items.length < 2) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /** Whether the device's Device On switch is off. */
  static isOff(device: DeviceSnapshot): boolean {
    return device.parameters.some((parameter) => parameter.name === DEVICE_ON && parameter.value === 0);
  }

  /** "3", "3–4 and 7": numbers counted from 1, consecutive ones as a span. */
  static spans(numbers: readonly number[]): string {
    const runs: [number, number][] = [];
    for (const number of numbers) {
      const run = runs[runs.length - 1];
      if (run && run[1] === number - 1) run[1] = number;
      else runs.push([number, number]);
    }
    return SetWording.list(runs.map(([first, last]) => (first === last ? `${first}` : `${first}–${last}`)));
  }
}

/** Plain words for a change to the lyrics text, from comparing it line by line. */
export class LyricsWording {
  /** "Lyrics · Verse 1 line 2", "Lyrics · Verse 2 lines 1–2 and Chorus line 3", "Lyrics · 2 lines added", "Lyrics · line 5 and 1 line removed". */
  static label(before: string, after: string): string {
    return `Lyrics · ${LyricsWording.words(before, after)}`;
  }

  /**
   * Sung lines that replace others are named where they are in the new text, by the label they come under and their
   * number among its sung lines; lines only added or removed are counted; the count skips blank lines and labels.
   */
  static words(before: string, after: string): string {
    const oldLines = LyricsWording.lines(before);
    const newLines = LyricsWording.lines(after);
    const changed: number[] = [];
    let added = 0;
    let removed = 0;
    for (const hunk of diffIndices(oldLines, newLines)) {
      const [oldStart, oldLength] = hunk.buffer1;
      const [newStart, newLength] = hunk.buffer2;
      const oldSung = oldLines.slice(oldStart, oldStart + oldLength).filter((line) => LyricsText.isSung(line)).length;
      const newSung = Array.from({ length: newLength }, (_, offset) => newStart + offset).filter((index) => LyricsText.isSung(newLines[index] ?? ""));
      const replaced = Math.min(oldSung, newSung.length);
      changed.push(...newSung.slice(0, replaced));
      added += newSung.length - replaced;
      removed += oldSung - replaced;
    }
    const parts = LyricsWording.places(newLines, changed);
    if (added > 0) parts.push(`${SetWording.count(added, "line")} added`);
    if (removed > 0) parts.push(`${SetWording.count(removed, "line")} removed`);
    return SetWording.list(parts) || "changed";
  }

  /** "Verse 1 line 2", "Chorus lines 1–2", or "line 5" for lines above the first label, one part per label in order. */
  private static places(lines: readonly string[], indexes: number[]): string[] {
    const byLabel = new Map<string, number[]>();
    for (const index of indexes) {
      const { label, line } = LyricsText.place(lines, index);
      const key = label ?? "";
      byLabel.set(key, [...(byLabel.get(key) ?? []), line]);
    }
    return [...byLabel].map(([label, numbers]) => `${label ? `${label} ` : ""}${numbers.length === 1 ? "line" : "lines"} ${SetWording.spans(numbers)}`);
  }

  /** An empty text gives an empty list of lines. */
  private static lines(text: string): string[] {
    return text === "" ? [] : LyricsText.lines(text);
  }
}

/**
 * The changes from one snapshot of the Set to the next, and applying changes to a snapshot.
 * Tracks match by tag, then by a name only one track has, then by position; clips by where they sit; devices in chain
 * order with the same class; parameters by index, compared only when both values were read. Tags only match objects.
 * Removed and changed objects are addressed by their place in `from`, added ones by their place in `to`; a TrackKey is
 * the track's place in `from` unless the track itself was added. Changes apply in that order: changed values, then
 * removals (innermost and last first), then additions (outermost and first first). A send that comes with an added
 * return track is a parameter change of kind added, numbered by its place in `to`.
 * Values: key a SongKey, signature { numerator, denominator }, locators and scenes the whole list; track, clip and
 * device present the TrackSnapshot, the clip with its notes or audio, and the DeviceSnapshot (changed: its name,
 * sample or chains); notes a Note[], loop a ClipLoop, audio a ClipAudio; every other field its value.
 * When both snapshots have a lead sheet, its lyrics are one change (the text on each side), its sections match by id
 * (the Section on each side: chords, name, kind and place) and everything else in it is one details change
 * (SheetDetails); applying writes the lyrics text, keeps the sheet's settings, version and lyrics revision, and orders
 * sections by start beat. Track order, groups, take lane names and the grid sit outside every field, so they go unrecorded.
 */
export class SetDiff {
  static between(from: SetSnapshot, to: SetSnapshot): SetChange[] {
    return new DiffBuilder(from, to).run();
  }

  /** The snapshot with the changes' `after` applied, on a copy. */
  static apply(snapshot: SetSnapshot, changes: SetChange[]): SetSnapshot {
    return new SnapshotPatcher(snapshot).apply(changes);
  }

  /** "12 edits on Drums and Pad", "5 edits on Bass and the lyrics", or "Song settings" when only the song changed. */
  static summary(changes: SetChange[]): string {
    if (changes.length === 0) return "Everything stayed the same";
    const tracks = TouchedTracks.names(changes);
    const lyrics = changes.some((change) => change.target.scope === "sheet" && change.target.field === "lyrics");
    const sheet = changes.some((change) => change.target.scope === "sheet" && change.target.field !== "lyrics");
    if (tracks.length === 0 && !lyrics && !sheet) return "Song settings";
    const named = tracks.slice(0, SUMMARY_TRACK_NAMES);
    const more = tracks.length - named.length;
    if (more > 0) named.push(`${more} more ${more === 1 ? "track" : "tracks"}`);
    if (lyrics) named.push("the lyrics");
    if (sheet) named.push("the lead sheet");
    if (changes.some((change) => change.target.scope === "song")) named.push("song settings");
    return `${SetWording.count(changes.length, "edit")} on ${SetWording.list(named)}`;
  }
}

/** The tracks a list of changes touches. */
export class TouchedTracks {
  /** Their names, once each, in the order the changes first touch them. */
  static names(changes: readonly SetChange[]): string[] {
    return [...new Set(TouchedTracks.groups(changes).map((group) => group.track))];
  }

  /** The changes by track, in the order the tracks first appear; song and lead sheet changes are left out. */
  static groups(changes: readonly SetChange[]): { track: string; changes: SetChange[] }[] {
    const groups = new Map<string, { track: string; changes: SetChange[] }>();
    for (const change of changes) {
      const target = change.target;
      if (target.scope === "song" || target.scope === "sheet") continue;
      const id = `${target.track.list} ${target.track.index} ${target.track.name}`;
      const group = groups.get(id) ?? { track: target.track.name, changes: [] };
      group.changes.push(change);
      groups.set(id, group);
    }
    return [...groups.values()];
  }
}

/** Which positions in one list hold the same objects as positions in another. */
class Pairing {
  private readonly toByFrom = new Map<number, number>();
  private readonly fromByTo = new Map<number, number>();

  constructor(
    readonly fromCount: number,
    readonly toCount: number,
  ) {}

  pair(from: number, to: number): void {
    this.toByFrom.set(from, to);
    this.fromByTo.set(to, from);
  }

  toOf(from: number): number | undefined {
    return this.toByFrom.get(from);
  }

  hasFrom(from: number): boolean {
    return this.toByFrom.has(from);
  }

  hasTo(to: number): boolean {
    return this.fromByTo.has(to);
  }

  /** Pairs in `from` order. */
  pairs(): [number, number][] {
    return [...this.toByFrom].sort((a, b) => a[0] - b[0]);
  }

  /** Positions in `from` without a partner. */
  freeFrom(): number[] {
    return positions(this.fromCount).filter((index) => !this.toByFrom.has(index));
  }

  /** Positions in `to` without a partner: what was added. */
  freeTo(): number[] {
    return positions(this.toCount).filter((index) => !this.fromByTo.has(index));
  }
}

/** Finds which objects of one snapshot are the same objects in the next. */
class Matcher {
  /** By Ode's tag, then by a name only one track has, then by position: equal names in order, then what is left between them. */
  static tracks(from: readonly TrackSnapshot[], to: readonly TrackSnapshot[]): Pairing {
    const pairing = new Pairing(from.length, to.length);
    const fits = (i: number, j: number) => Matcher.mayBeSameTrack(itemAt(from, i), itemAt(to, j));
    Matcher.byKey(pairing, from, to, (track) => track.tag, fits);
    Matcher.byKey(pairing, from, to, (track) => SetWording.name(track), fits);
    const sameName = (i: number, j: number) => SetWording.name(itemAt(from, i)) === SetWording.name(itemAt(to, j)) && fits(i, j);
    for (const [i, j] of Matcher.align(pairing.freeFrom(), pairing.freeTo(), sameName)) pairing.pair(i, j);
    Matcher.fillGaps(pairing, fits);
    return pairing;
  }

  /** In chain order, with the same class. */
  static devices(from: readonly DeviceSnapshot[], to: readonly DeviceSnapshot[]): Pairing {
    const pairing = new Pairing(from.length, to.length);
    const sameClass = (i: number, j: number) => itemAt(from, i).className === itemAt(to, j).className;
    for (const [i, j] of Matcher.align(positions(from.length), positions(to.length), sameClass)) pairing.pair(i, j);
    return pairing;
  }

  /** Tracks of different kinds, or with different tags, are always different tracks. */
  private static mayBeSameTrack(a: TrackSnapshot, b: TrackSnapshot): boolean {
    return a.kind === b.kind && !(a.tag && b.tag && a.tag !== b.tag);
  }

  /** Pairs items by a key that only one item has on each side. */
  private static byKey<T>(
    pairing: Pairing,
    from: readonly T[],
    to: readonly T[],
    keyOf: (item: T) => string | undefined,
    fits: (i: number, j: number) => boolean,
  ): void {
    const targets = Matcher.uniqueKeys(to, keyOf);
    for (const [key, i] of Matcher.uniqueKeys(from, keyOf)) {
      const j = targets.get(key);
      if (j !== undefined && !pairing.hasFrom(i) && !pairing.hasTo(j) && fits(i, j)) pairing.pair(i, j);
    }
  }

  /** The keys only one item has, with that item's position. */
  private static uniqueKeys<T>(items: readonly T[], keyOf: (item: T) => string | undefined): Map<string, number> {
    const found = new Map<string, number>();
    const repeated = new Set<string>();
    items.forEach((item, index) => {
      const key = keyOf(item);
      if (!key) return;
      if (found.has(key)) repeated.add(key);
      found.set(key, index);
    });
    for (const key of repeated) found.delete(key);
    return found;
  }

  /** The most pairs of equal items that keep both lists in order (a longest common subsequence). */
  private static align(from: readonly number[], to: readonly number[], same: (i: number, j: number) => boolean): [number, number][] {
    const width = to.length + 1;
    const lengths = new Array<number>((from.length + 1) * width).fill(0);
    const at = (row: number, column: number) => lengths[row * width + column] ?? 0;
    for (let row = from.length - 1; row >= 0; row--) {
      for (let column = to.length - 1; column >= 0; column--) {
        lengths[row * width + column] = same(itemAt(from, row), itemAt(to, column))
          ? at(row + 1, column + 1) + 1
          : Math.max(at(row + 1, column), at(row, column + 1));
      }
    }
    const pairs: [number, number][] = [];
    let row = 0;
    let column = 0;
    while (row < from.length && column < to.length) {
      const i = itemAt(from, row);
      const j = itemAt(to, column);
      if (same(i, j) && at(row, column) === at(row + 1, column + 1) + 1) {
        pairs.push([i, j]);
        row += 1;
        column += 1;
      } else if (at(row + 1, column) >= at(row, column + 1)) {
        row += 1;
      } else {
        column += 1;
      }
    }
    return pairs;
  }

  /** Pairs what is left between matched neighbours, in order: a renamed track keeps its place. */
  private static fillGaps(pairing: Pairing, fits: (i: number, j: number) => boolean): void {
    const anchors: [number, number][] = [...pairing.pairs(), [pairing.fromCount, pairing.toCount]];
    let previous: [number, number] = [-1, -1];
    for (const anchor of anchors) {
      const from = pairing.freeFrom().filter((i) => i > previous[0] && i < anchor[0]);
      const to = pairing.freeTo().filter((j) => j > previous[1] && j < anchor[1]);
      let next = 0;
      for (const i of from) {
        const found = to.findIndex((j, position) => position >= next && fits(i, j));
        if (found < 0) continue;
        pairing.pair(i, itemAt(to, found));
        next = found + 1;
      }
      previous = anchor;
    }
  }
}

/** Equality for plain data; a property set to undefined counts as missing. */
class Values {
  static same(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for (let index = 0; index < a.length; index++) if (!Values.same(a[index], b[index])) return false;
      return true;
    }
    if (!isRecord(a) || !isRecord(b)) return false;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!Values.same(a[key], b[key])) return false;
    return true;
  }
}

/** A clip's MIDI notes, compared as a set, in any order. */
class Notes {
  static same(a: readonly Note[], b: readonly Note[]): boolean {
    if (a.length !== b.length) return false;
    if (a.every((note, index) => Notes.key(note) === Notes.key(itemAt(b, index)))) return true;
    const sorted = b.map((note) => Notes.key(note)).sort();
    return a
      .map((note) => Notes.key(note))
      .sort()
      .every((key, index) => key === sorted[index]);
  }

  /** The notes only one side has, counting repeats: what was removed, changed or added. */
  static changed(a: readonly Note[], b: readonly Note[]): Note[] {
    return [...Notes.missing(a, b), ...Notes.missing(b, a)];
  }

  /** The notes of `notes` that `other` lacks. */
  private static missing(notes: readonly Note[], other: readonly Note[]): Note[] {
    const counts = new Map<string, number>();
    for (const note of other) {
      const key = Notes.key(note);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return notes.filter((note) => {
      const key = Notes.key(note);
      const left = counts.get(key) ?? 0;
      counts.set(key, left - 1);
      return left <= 0;
    });
  }

  private static key(note: Note): string {
    return [
      note.pitch,
      note.start,
      note.duration,
      note.velocity,
      note.muted,
      note.probability,
      note.velocityDeviation,
      note.releaseVelocity,
    ].join("|");
  }
}

/** A track's sends: one per return track, after volume and pan. */
class Sends {
  /** The send every track gets with a new return track: silent, with the return's own send as the pattern. */
  static fresh(returnTrack: TrackSnapshot, at: number): ParameterInfo & { value: number } {
    const own = returnTrack.mixer.sends[at];
    const pattern: ParameterInfo = own
      ? structuredClone(own)
      : {
          index: FIRST_SEND_PARAMETER + at,
          name: SetWording.name(returnTrack),
          min: SEND_MIN,
          max: SEND_MAX,
          isQuantized: false,
          defaultValue: SEND_MIN,
          valueItems: [],
        };
    return { ...pattern, index: FIRST_SEND_PARAMETER + at, value: pattern.min };
  }

  /** The mixer parameter DeviceRef numbers `index`: volume, pan or a send. */
  static parameter(track: TrackSnapshot, index: number): ParameterInfo | undefined {
    if (index === VOLUME_PARAMETER) return track.mixer.volume;
    if (index === PAN_PARAMETER) return track.mixer.panning;
    return track.mixer.sends[index - FIRST_SEND_PARAMETER];
  }

  static renumber(track: TrackSnapshot): void {
    track.mixer.sends.forEach((send, position) => (send.index = FIRST_SEND_PARAMETER + position));
  }
}

/** Works out the changes from one snapshot to the next, each with its label. */
class DiffBuilder {
  private readonly changes: SetChange[] = [];
  private readonly beatsPerBar: number | null;
  /** The return tracks in both snapshots, which also pair up every track's sends. */
  private readonly returns: Pairing;

  constructor(
    private readonly from: SetSnapshot,
    private readonly to: SetSnapshot,
  ) {
    this.beatsPerBar = SetWording.beatsPerBar(to.signature);
    this.returns = Matcher.tracks(from.returnTracks, to.returnTracks);
  }

  run(): SetChange[] {
    this.song();
    this.sheet();
    this.trackList(TrackList.Tracks, this.from.tracks, this.to.tracks, Matcher.tracks(this.from.tracks, this.to.tracks));
    this.trackList(TrackList.Returns, this.from.returnTracks, this.to.returnTracks, this.returns);
    this.track(this.from.main, this.to.main, DiffBuilder.key(TrackList.Main, 0, this.from.main));
    return this.changes;
  }

  private static key(list: TrackList, index: number, track: TrackSnapshot): TrackKey {
    const name = SetWording.name(track) || (list === TrackList.Main ? "Main" : `track ${index + 1}`);
    const key: TrackKey = { list, index, name };
    if (track.tag) key.tag = track.tag;
    return key;
  }

  /** Values are copied, so each change holds its own copy of the data. */
  private add(kind: ChangeKind, target: ChangeTarget, label: string, before: unknown, after: unknown): void {
    const change: SetChange = { kind, target, label };
    if (before !== undefined) change.before = structuredClone(before);
    if (after !== undefined) change.after = structuredClone(after);
    this.changes.push(change);
  }

  private song(): void {
    const before = this.from.song;
    const after = this.to.song;
    if (before.tempo !== after.tempo) {
      const label = `Song · tempo ${SetWording.tempo(before.tempo)} → ${SetWording.tempo(after.tempo)} BPM`;
      this.add(ChangeKind.Changed, { scope: "song", field: "tempo" }, label, before.tempo, after.tempo);
    }
    const keyBefore = DiffBuilder.songKey(before);
    const keyAfter = DiffBuilder.songKey(after);
    if (!Values.same(keyBefore, keyAfter)) {
      this.add(ChangeKind.Changed, { scope: "song", field: "key" }, `Song · ${DiffBuilder.keyWords(keyBefore, keyAfter)}`, keyBefore, keyAfter);
    }
    const signatureBefore = this.from.signature;
    const signatureAfter = this.to.signature;
    if (!Values.same(signatureBefore, signatureAfter)) {
      const label = `Song · time signature ${SetWording.signature(signatureBefore)} → ${SetWording.signature(signatureAfter)}`;
      this.add(ChangeKind.Changed, { scope: "song", field: "signature" }, label, signatureBefore, signatureAfter);
    }
    if (!Values.same(before.locators, after.locators)) {
      const label = `Song · ${this.locatorWords(before.locators, after.locators)}`;
      this.add(ChangeKind.Changed, { scope: "song", field: "locators" }, label, before.locators, after.locators);
    }
    if (!Values.same(before.scenes, after.scenes)) {
      const label = `Song · ${DiffBuilder.sceneWords(before.scenes, after.scenes)}`;
      this.add(ChangeKind.Changed, { scope: "song", field: "scenes" }, label, before.scenes, after.scenes);
    }
  }

  private static songKey(song: SetSnapshot["song"]): SongKey {
    return { rootNote: song.rootNote, scaleName: song.scaleName, scaleMode: song.scaleMode, scaleIntervals: [...song.scaleIntervals] };
  }

  private static keyWords(before: SongKey, after: SongKey): string {
    const parts: string[] = [];
    if (before.rootNote !== after.rootNote || before.scaleName !== after.scaleName) {
      parts.push(`key ${SetWording.key(before.rootNote, before.scaleName)} → ${SetWording.key(after.rootNote, after.scaleName)}`);
    }
    if (before.scaleMode !== after.scaleMode) parts.push(`Scale Mode ${after.scaleMode ? "on" : "off"}`);
    return parts.join(", ") || "scale changed";
  }

  /** "locator Chorus added at bar 9", "locator Verse moved to bar 5", "locator Intro renamed Start". */
  private locatorWords(before: readonly LocatorInfo[], after: readonly LocatorInfo[]): string {
    const removed = before.filter((old) => !after.some((locator) => DiffBuilder.sameLocator(old, locator)));
    const added = after.filter((locator) => !before.some((old) => DiffBuilder.sameLocator(old, locator)));
    const parts: string[] = [];
    for (const old of removed) {
      const sameName = added.findIndex((locator) => locator.name === old.name);
      const index = sameName >= 0 ? sameName : added.findIndex((locator) => locator.time === old.time);
      const match = added[index];
      if (!match) {
        parts.push(`locator ${this.locatorName(old)} removed`);
        continue;
      }
      added.splice(index, 1);
      parts.push(
        match.name === old.name
          ? `locator ${this.locatorName(old)} moved to ${this.barAt(match.time)}`
          : `locator ${this.locatorName(old)} ${match.name ? `renamed ${match.name}` : "name cleared"}`,
      );
    }
    for (const locator of added) {
      parts.push(`${locator.name ? `locator ${locator.name}` : "locator"} added at ${this.barAt(locator.time)}`);
    }
    return parts.join(", ") || "locators changed";
  }

  private static sameLocator(a: LocatorInfo, b: LocatorInfo): boolean {
    return a.name === b.name && a.time === b.time;
  }

  private locatorName(locator: LocatorInfo): string {
    return locator.name || `at ${this.barAt(locator.time)}`;
  }

  private barAt(beat: number): string {
    return SetWording.position(beat, this.beatsPerBar);
  }

  /** "scene Bridge added", "2 scenes removed", "scene 3 renamed Chorus", "scene Chorus tempo 120 → 128 BPM". */
  private static sceneWords(before: readonly SceneInfo[], after: readonly SceneInfo[]): string {
    if (after.length > before.length) {
      return DiffBuilder.scenesAddedOrRemoved(after.length - before.length, DiffBuilder.extraNames(after, before), "added");
    }
    if (after.length < before.length) {
      return DiffBuilder.scenesAddedOrRemoved(before.length - after.length, DiffBuilder.extraNames(before, after), "removed");
    }
    const parts: string[] = [];
    after.forEach((scene, index) => {
      const old = before[index];
      if (!old) return;
      const name = scene.name || `${index + 1}`;
      if (old.name !== scene.name) {
        parts.push(`scene ${index + 1} ${scene.name ? `renamed ${scene.name}` : "name cleared"}`);
      } else if (old.tempo !== scene.tempo) {
        parts.push(`scene ${name} tempo ${SetWording.tempo(old.tempo)} → ${SetWording.tempo(scene.tempo)} BPM`);
      } else if (old.signatureNumerator !== scene.signatureNumerator || old.signatureDenominator !== scene.signatureDenominator) {
        const was = `${old.signatureNumerator}/${old.signatureDenominator}`;
        parts.push(`scene ${name} time signature ${was} → ${scene.signatureNumerator}/${scene.signatureDenominator}`);
      }
    });
    return parts.join(", ") || "scenes changed";
  }

  /** "scenes Bridge and Outro added", or "2 scenes added" when they are unnamed. */
  private static scenesAddedOrRemoved(count: number, names: readonly string[], verb: string): string {
    if (names.length === count) return `${count === 1 ? "scene" : "scenes"} ${SetWording.list(names)} ${verb}`;
    return `${SetWording.count(count, "scene")} ${verb}`;
  }

  /** The names in `items` that `other` lacks, counting repeats; empty names are left out. */
  private static extraNames(items: readonly SceneInfo[], other: readonly SceneInfo[]): string[] {
    const counts = new Map<string, number>();
    for (const item of other) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    const extra: string[] = [];
    for (const item of items) {
      const left = counts.get(item.name) ?? 0;
      if (left > 0) counts.set(item.name, left - 1);
      else if (item.name) extra.push(item.name);
    }
    return extra;
  }

  /** The lead sheet's lyrics as one change, its sections by id (in `to`'s order, then the removed ones), then its details as one change. */
  private sheet(): void {
    const before = this.from.sheet;
    const after = this.to.sheet;
    if (!before || !after) return;
    if (before.lyrics !== after.lyrics) {
      const target: ChangeTarget = { scope: "sheet", field: "lyrics" };
      this.add(ChangeKind.Changed, target, LyricsWording.label(before.lyrics, after.lyrics), before.lyrics, after.lyrics);
    }
    const earlier = new Map(before.sections.map((section): [string, Section] => [section.id, section]));
    const later = new Set(after.sections.map((section) => section.id));
    for (const section of after.sections) {
      const old = earlier.get(section.id);
      const target: ChangeTarget = { scope: "sheet", field: "section", section: section.id };
      if (!old) this.add(ChangeKind.Added, target, `${DiffBuilder.sectionName(section)} · added`, undefined, section);
      else if (!DiffBuilder.sameSection(old, section)) this.add(ChangeKind.Changed, target, this.sectionWords(old, section), old, section);
    }
    for (const section of before.sections) {
      if (later.has(section.id)) continue;
      const target: ChangeTarget = { scope: "sheet", field: "section", section: section.id };
      this.add(ChangeKind.Removed, target, `${DiffBuilder.sectionName(section)} · removed`, section, undefined);
    }
    const detailsBefore = DiffBuilder.sheetDetails(before);
    const detailsAfter = DiffBuilder.sheetDetails(after);
    if (!Values.same(detailsBefore, detailsAfter)) {
      const label = `Lead sheet · ${DiffBuilder.detailWords(detailsBefore, detailsAfter)}`;
      this.add(ChangeKind.Changed, { scope: "sheet", field: "details" }, label, detailsBefore, detailsAfter);
    }
  }

  private static sameSection(a: Section, b: Section): boolean {
    return (
      a.name === b.name &&
      a.kind === b.kind &&
      a.startBeat === b.startBeat &&
      a.lengthBeats === b.lengthBeats &&
      Values.same(a.chords, b.chords)
    );
  }

  /** "Chords · Chorus", "Song form · Bridge · bars 17–24", or "Chorus · chords and renamed Hook". */
  private sectionWords(before: Section, after: Section): string {
    const name = DiffBuilder.sectionName(before);
    const chords = !Values.same(before.chords, after.chords);
    const form = this.formWords(before, after);
    if (form.length === 0) return `Chords · ${name}`;
    if (!chords) return `Song form · ${name} · ${form.join(", ")}`;
    return `${name} · ${SetWording.list(["chords", ...form])}`;
  }

  /** "renamed Middle 8", "verse → chorus", "bars 17–24": what changed in the section's place in the song form. */
  private formWords(before: Section, after: Section): string[] {
    const parts: string[] = [];
    if (before.name !== after.name) parts.push(after.name ? `renamed ${after.name}` : "name cleared");
    if (before.kind !== after.kind) parts.push(`${before.kind} → ${after.kind}`);
    if (before.startBeat !== after.startBeat || before.lengthBeats !== after.lengthBeats) {
      parts.push(SetWording.bars(after.startBeat, after.startBeat + after.lengthBeats, this.beatsPerBar));
    }
    return parts;
  }

  /** The section's name, or its kind when it is unnamed: "Pre-chorus". */
  private static sectionName(section: Section): string {
    return section.name || `${section.kind.charAt(0).toUpperCase()}${section.kind.slice(1)}`;
  }

  /** The lead sheet's other details: everything beyond its lyrics, sections, the musician's settings and the format version. */
  private static sheetDetails(sheet: LeadSheet): SheetDetails {
    const { lyrics: _lyrics, lyricsRevision: _revision, sections: _sections, version: _version, settings: _settings, ...details } = sheet;
    return details;
  }

  /** "title 'Old' → 'New'", "credits and notes". */
  private static detailWords(before: SheetDetails, after: SheetDetails): string {
    const parts: string[] = before.title === after.title ? [] : [`title '${before.title}' → '${after.title}'`];
    for (const [field, words] of SHEET_DETAIL_WORDS) if (!Values.same(before[field], after[field])) parts.push(words);
    return SetWording.list(parts) || "details changed";
  }

  private trackList(list: TrackList, before: readonly TrackSnapshot[], after: readonly TrackSnapshot[], pairing: Pairing): void {
    before.forEach((track, index) => {
      const key = DiffBuilder.key(list, index, track);
      const partner = pairing.toOf(index);
      if (partner === undefined) {
        this.add(ChangeKind.Removed, { scope: "track", track: key, field: "present" }, `${key.name} · removed`, track, undefined);
      } else {
        this.track(track, itemAt(after, partner), key);
      }
    });
    for (const index of pairing.freeTo()) {
      const track = itemAt(after, index);
      const key = DiffBuilder.key(list, index, track);
      this.add(ChangeKind.Added, { scope: "track", track: key, field: "present" }, `${key.name} · added`, undefined, track);
    }
  }

  private track(before: TrackSnapshot, after: TrackSnapshot, track: TrackKey): void {
    const target = (field: TrackField): ChangeTarget => ({ scope: "track", track, field });
    const who = track.name;
    const name = SetWording.name(after);
    if (SetWording.name(before) !== name) this.add(ChangeKind.Changed, target("name"), `${who} · renamed ${name}`, before.name, after.name);
    if (before.mute !== after.mute) this.add(ChangeKind.Changed, target("mute"), `${who} · ${after.mute ? "muted" : "unmuted"}`, before.mute, after.mute);
    if (before.solo !== after.solo) this.add(ChangeKind.Changed, target("solo"), `${who} · ${after.solo ? "soloed" : "unsoloed"}`, before.solo, after.solo);
    if (before.arm !== after.arm) this.add(ChangeKind.Changed, target("arm"), `${who} · ${after.arm ? "armed" : "disarmed"}`, before.arm, after.arm);
    if (before.color !== after.color) this.add(ChangeKind.Changed, target("color"), `${who} · colour changed`, before.color, after.color);
    this.clips(before, after, track);
    this.devices(track, before.devices, after.devices, { from: [], to: [] }, []);
    this.mixer(before, after, track);
  }

  private clips(before: TrackSnapshot, after: TrackSnapshot, track: TrackKey): void {
    const slots = Math.max(before.clipSlots.length, after.clipSlots.length);
    for (let slot = 0; slot < slots; slot++) {
      this.clip(track, { slot }, before.clipSlots[slot]?.clip ?? null, after.clipSlots[slot]?.clip ?? null);
    }
    this.lane(track, before.arrangementClips, after.arrangementClips, undefined);
    const lanes = Math.max(before.takeLanes.length, after.takeLanes.length);
    for (let lane = 0; lane < lanes; lane++) {
      this.lane(track, before.takeLanes[lane]?.clips ?? [], after.takeLanes[lane]?.clips ?? [], lane);
    }
  }

  /** The Arrangement clips on one lane (undefined: the track's main lane), matched by where they start. */
  private lane(track: TrackKey, before: readonly ClipInfo[], after: readonly ClipInfo[], lane: number | undefined): void {
    const earlier = new Map(before.map((clip): [number, ClipInfo] => [clip.startTime, clip]));
    const later = new Map(after.map((clip): [number, ClipInfo] => [clip.startTime, clip]));
    const starts = [...new Set([...earlier.keys(), ...later.keys()])].sort((a, b) => a - b);
    for (const start of starts) {
      this.clip(track, lane === undefined ? { start } : { start, lane }, earlier.get(start) ?? null, later.get(start) ?? null);
    }
  }

  private clip(track: TrackKey, place: ClipKey, before: ClipInfo | null, after: ClipInfo | null): void {
    if (before && after && DiffBuilder.mayBeSameClip(before, after)) {
      this.clipFields(track, place, before, after);
      return;
    }
    if (before) {
      const label = `${track.name} · removed ${this.clipPlace(before, place)}`;
      this.add(ChangeKind.Removed, { scope: "clip", track, clip: place, field: "present" }, label, before, undefined);
    }
    if (after) {
      const label = `${track.name} · added ${this.clipPlace(after, place)}`;
      this.add(ChangeKind.Added, { scope: "clip", track, clip: place, field: "present" }, label, undefined, after);
    }
  }

  /** A MIDI clip and an audio clip are always different clips, and so are clips with different tags. */
  private static mayBeSameClip(a: ClipInfo, b: ClipInfo): boolean {
    return a.kind === b.kind && !(a.tag && b.tag && a.tag !== b.tag);
  }

  private clipFields(track: TrackKey, place: ClipKey, before: ClipInfo, after: ClipInfo): void {
    const target = (field: ClipField): ChangeTarget => ({ scope: "clip", track, clip: place, field });
    const what = `${track.name} · ${this.clipId(before, place)}`;
    const notesBefore = before.notes ?? [];
    const notesAfter = after.notes ?? [];
    if (before.kind === "midi" && !Notes.same(notesBefore, notesAfter)) {
      this.add(ChangeKind.Changed, target("notes"), this.notesLabel(track, place, before, after), notesBefore, notesAfter);
    }
    const name = SetWording.name(after);
    if (SetWording.name(before) !== name) {
      this.add(ChangeKind.Changed, target("name"), `${what} ${name ? `renamed ${name}` : "name cleared"}`, before.name, after.name);
    }
    if (before.muted !== after.muted) {
      this.add(ChangeKind.Changed, target("muted"), `${what} ${after.muted ? "deactivated" : "activated"}`, before.muted, after.muted);
    }
    if (before.color !== after.color) this.add(ChangeKind.Changed, target("color"), `${what} colour changed`, before.color, after.color);
    const loopBefore = DiffBuilder.loop(before, place);
    const loopAfter = DiffBuilder.loop(after, place);
    if (!Values.same(loopBefore, loopAfter)) {
      this.add(ChangeKind.Changed, target("loop"), `${what} · ${this.loopWords(loopBefore, loopAfter)}`, loopBefore, loopAfter);
    }
    if (before.kind !== "audio") return;
    const audioBefore = DiffBuilder.audio(before);
    const audioAfter = DiffBuilder.audio(after);
    if (!Values.same(audioBefore, audioAfter)) {
      this.add(ChangeKind.Changed, target("audio"), `${what} · ${DiffBuilder.audioWords(audioBefore, audioAfter)}`, audioBefore, audioAfter);
    }
  }

  /** "Bass · notes in bars 9–16" (song bars in the Arrangement), "Bass · clip Bass A · notes in bars 1–4" (clip bars). */
  private notesLabel(track: TrackKey, place: ClipKey, before: ClipInfo, after: ClipInfo): string {
    let start = Infinity;
    let end = -Infinity;
    for (const note of Notes.changed(before.notes ?? [], after.notes ?? [])) {
      start = Math.min(start, note.start);
      end = Math.max(end, note.start + note.duration);
    }
    const clip = `${track.name} · ${this.clipId(before, place)}`;
    if (start > end) return `${clip} · notes changed`;
    if ("slot" in place) return `${clip} · notes in ${SetWording.bars(start, end, this.beatsPerBar)}`;
    const offset = after.startTime - after.startMarker;
    const bars = SetWording.bars(Math.max(after.startTime, start + offset), Math.max(after.startTime, end + offset), this.beatsPerBar);
    return place.lane === undefined ? `${track.name} · notes in ${bars}` : `${track.name} · take lane ${place.lane + 1} · notes in ${bars}`;
  }

  /** "clip Bass A", or where the clip is when it is unnamed. */
  private clipId(clip: ClipInfo, place: ClipKey): string {
    const name = SetWording.name(clip);
    if ("slot" in place) return name ? `clip ${name}` : `clip in slot ${place.slot + 1}`;
    const lane = place.lane === undefined ? "" : ` on take lane ${place.lane + 1}`;
    return `${name ? `clip ${name}` : `clip in ${SetWording.bars(clip.startTime, clip.endTime, this.beatsPerBar)}`}${lane}`;
  }

  /** "clip Bass A in bars 9–16", "clip Fill in slot 3". */
  private clipPlace(clip: ClipInfo, place: ClipKey): string {
    const name = SetWording.name(clip);
    const title = name ? `clip ${name}` : "clip";
    if ("slot" in place) return `${title} in slot ${place.slot + 1}`;
    const lane = place.lane === undefined ? "" : ` on take lane ${place.lane + 1}`;
    return `${title} in ${SetWording.bars(clip.startTime, clip.endTime, this.beatsPerBar)}${lane}`;
  }

  /** Session clips leave out where they start and end: Live moves those when a clip is launched. */
  private static loop(clip: ClipInfo, place: ClipKey): ClipLoop {
    const loop: ClipLoop = {
      looping: clip.looping,
      loopStart: clip.loopStart,
      loopEnd: clip.loopEnd,
      startMarker: clip.startMarker,
      endMarker: clip.endMarker,
      duration: clip.duration,
    };
    if (!("slot" in place)) loop.endTime = clip.endTime;
    return loop;
  }

  private static audio(clip: ClipInfo): ClipAudio {
    const { filePath, warping, warpMode, warpMarkers } = clip as AudioClipInfo;
    return { filePath, warping, warpMode, warpMarkers };
  }

  private loopWords(before: ClipLoop, after: ClipLoop): string {
    if (before.looping !== after.looping) return after.looping ? "loop on" : "loop off";
    if (before.loopStart !== after.loopStart || before.loopEnd !== after.loopEnd) {
      const was = SetWording.barSpan(before.loopStart, before.loopEnd, this.beatsPerBar);
      return `loop ${this.beatsPerBar === null ? "beats" : "bars"} ${was} → ${SetWording.barSpan(after.loopStart, after.loopEnd, this.beatsPerBar)}`;
    }
    if (before.duration !== after.duration) {
      const unit = this.beatsPerBar === null ? "beats" : "bars";
      const divisor = this.beatsPerBar ?? 1;
      return `length ${SetWording.number(before.duration / divisor)} → ${SetWording.number(after.duration / divisor)} ${unit}`;
    }
    return "start and end changed";
  }

  private static audioWords(before: ClipAudio, after: ClipAudio): string {
    const parts: string[] = [];
    if (before.filePath !== after.filePath) {
      parts.push(`file ${SetWording.fileName(before.filePath) || "empty"} → ${SetWording.fileName(after.filePath) || "empty"}`);
    }
    if (before.warping !== after.warping) parts.push(after.warping ? "warping on" : "warping off");
    if (before.warpMode !== after.warpMode) parts.push(`warp mode ${SetWording.warpMode(before.warpMode)} → ${SetWording.warpMode(after.warpMode)}`);
    if (!Values.same(before.warpMarkers, after.warpMarkers)) parts.push("warp markers moved");
    return parts.join(", ") || "audio changed";
  }

  /** The devices in one list, a track's or a chain's, at the chain paths `place.from` and `place.to`. */
  private devices(
    track: TrackKey,
    before: readonly DeviceSnapshot[],
    after: readonly DeviceSnapshot[],
    place: Pick<DevicePlace, "from" | "to">,
    context: readonly string[],
  ): void {
    const pairing = Matcher.devices(before, after);
    before.forEach((device, index) => {
      const partner = pairing.toOf(index);
      if (partner === undefined) {
        const label = DiffBuilder.words(track, context, `removed ${device.name}`);
        this.add(ChangeKind.Removed, { scope: "device", track, chain: [...place.from], index, field: "present" }, label, device, undefined);
      } else {
        this.device(track, device, itemAt(after, partner), { ...place, fromIndex: index, toIndex: partner }, context);
      }
    });
    for (const index of pairing.freeTo()) {
      const device = itemAt(after, index);
      const label = DiffBuilder.words(track, context, `added ${device.name}`);
      this.add(ChangeKind.Added, { scope: "device", track, chain: [...place.to], index, field: "present" }, label, undefined, device);
    }
  }

  private device(track: TrackKey, before: DeviceSnapshot, after: DeviceSnapshot, place: DevicePlace, context: readonly string[]): void {
    const target = (field: DeviceField, parameter?: number): ChangeTarget =>
      parameter === undefined
        ? { scope: "device", track, chain: [...place.from], index: place.fromIndex, field }
        : { scope: "device", track, chain: [...place.from], index: place.fromIndex, field, parameter };
    const itself = DiffBuilder.deviceWords(before, after);
    if (itself.length > 0) {
      this.add(ChangeKind.Changed, target("present"), DiffBuilder.words(track, [...context, before.name], itself.join(", ")), before, after);
    }
    const count = Math.min(before.parameters.length, after.parameters.length);
    for (let index = 0; index < count; index++) {
      const parameter = itemAt(before.parameters, index);
      const was = parameter.value;
      const now = itemAt(after.parameters, index).value;
      if (typeof was !== "number" || typeof now !== "number" || was === now) continue;
      this.add(ChangeKind.Changed, target("parameter", index), DiffBuilder.parameterWords(track, context, before.name, parameter, was, now), was, now);
    }
    const chainsBefore = before.chains ?? [];
    const chainsAfter = after.chains ?? [];
    for (let index = 0; index < Math.min(chainsBefore.length, chainsAfter.length); index++) {
      const chain = itemAt(chainsAfter, index);
      const previous = itemAt(chainsBefore, index);
      const chainPath = [...place.from, place.fromIndex, index];
      const chainContext = [...context, before.name, DiffBuilder.chainName(chain, index)];
      if (previous.mixer && chain.mixer) this.chainMixer(previous.mixer, chain.mixer, track, chainPath, chainContext);
      this.devices(
        track,
        previous.devices,
        chain.devices,
        { from: [...place.from, place.fromIndex, index], to: [...place.to, place.toIndex, index] },
        chainContext,
      );
    }
  }

  /** What changed in the device itself: its name, its sample or its chains. */
  private static deviceWords(before: DeviceSnapshot, after: DeviceSnapshot): string[] {
    const parts: string[] = [];
    if (before.name !== after.name) parts.push(`renamed ${after.name}`);
    if ((before.sample ?? null) !== (after.sample ?? null)) {
      parts.push(`sample ${SetWording.fileName(before.sample) || "empty"} → ${SetWording.fileName(after.sample) || "empty"}`);
    }
    const chainsBefore = before.chains ?? [];
    const chainsAfter = after.chains ?? [];
    const noun = [...chainsBefore, ...chainsAfter].some((chain) => chain.receivingNote !== undefined) ? "pads" : "chains";
    if (chainsBefore.length !== chainsAfter.length) parts.push(`${noun} ${chainsBefore.length} → ${chainsAfter.length}`);
    else if (chainsBefore.some((chain, index) => chain.receivingNote !== chainsAfter[index]?.receivingNote)) parts.push(`${noun} changed`);
    if (chainsBefore.some((chain, index) => Boolean(chain.mixer) !== Boolean(chainsAfter[index]?.mixer))) parts.push("chain mixer data availability changed");
    else if (chainsBefore.some((chain, index) => chain.mixer?.sends.length !== chainsAfter[index]?.mixer?.sends.length)) parts.push("chain mixer layout changed");
    return parts;
  }

  /** Chain sends belong to their rack, so compare them by chain-local index, not the Song's return-track order. */
  private chainMixer(before: MixerInfo, after: MixerInfo, track: TrackKey, chain: number[], context: readonly string[]): void {
    const previous = [before.volume, before.panning, ...before.sends];
    const current = [after.volume, after.panning, ...after.sends];
    previous.forEach((parameter, index) => {
      const was = parameter.value;
      const now = current[index]?.value;
      if (typeof was !== "number" || typeof now !== "number" || was === now) return;
      const what = index === 0 ? "volume" : index === 1 ? "pan" : `send ${index - 1}`;
      const wording = (value: number) => index === 1 ? SetWording.pan(value) : SetWording.value(parameter, value);
      this.add(ChangeKind.Changed, { scope: "device", track, chain, index: MIXER_INDEX, field: "parameter", parameter: index },
        DiffBuilder.words(track, context, `${what} ${wording(was)} → ${wording(now)}`), was, now);
    });
  }

  private static parameterWords(
    track: TrackKey,
    context: readonly string[],
    device: string,
    parameter: ParameterInfo,
    before: number,
    after: number,
  ): string {
    if (parameter.name === DEVICE_ON) return DiffBuilder.words(track, context, `${device} turned ${after ? "on" : "off"}`);
    const values = `${SetWording.value(parameter, before)} → ${SetWording.value(parameter, after)}`;
    return DiffBuilder.words(track, [...context, device], `${parameter.name} ${values}`);
  }

  /** "pad C1" for a Drum Rack pad, otherwise "chain 2". */
  private static chainName(chain: ChainSnapshot, index: number): string {
    return chain.receivingNote === undefined ? `chain ${index + 1}` : `pad ${noteName(chain.receivingNote)}`;
  }

  private static words(track: TrackKey, context: readonly string[], last: string): string {
    return [track.name, ...context, last].join(" · ");
  }

  private mixer(before: TrackSnapshot, after: TrackSnapshot, track: TrackKey): void {
    const { volume, panning, sends } = before.mixer;
    this.mixerChange(track, VOLUME_PARAMETER, "volume", volume, after.mixer.volume, (value) => SetWording.value(volume, value));
    this.mixerChange(track, PAN_PARAMETER, "pan", panning, after.mixer.panning, (value) => SetWording.pan(value));
    sends.forEach((send, index) => {
      const partner = this.returns.toOf(index);
      const next = partner === undefined ? undefined : after.mixer.sends[partner];
      if (!next) return;
      this.mixerChange(track, FIRST_SEND_PARAMETER + index, `send ${this.returnName(index, send)}`, send, next, (value) => SetWording.value(send, value));
    });
    if (sends.length !== this.from.returnTracks.length) return;
    // A send to an added return track starts where SetDiff.apply puts it; one set anywhere else is an added parameter.
    for (const index of this.returns.freeTo()) {
      const send = after.mixer.sends[index];
      const returnTrack = this.to.returnTracks[index];
      if (!send || !returnTrack || typeof send.value !== "number") continue;
      const fresh = Sends.fresh(returnTrack, index);
      if (send.value === fresh.value) continue;
      const label = `${track.name} · send ${SetWording.name(returnTrack)} ${SetWording.value(fresh, fresh.value)} → ${SetWording.value(send, send.value)}`;
      const target: ChangeTarget = { scope: "device", track, chain: [], index: MIXER_INDEX, field: "parameter", parameter: FIRST_SEND_PARAMETER + index };
      this.add(ChangeKind.Added, target, label, undefined, send.value);
    }
  }

  private mixerChange(
    track: TrackKey,
    parameter: number,
    what: string,
    before: ParameterInfo,
    after: ParameterInfo,
    words: (value: number) => string,
  ): void {
    const was = before.value;
    const now = after.value;
    if (typeof was !== "number" || typeof now !== "number" || was === now) return;
    const target: ChangeTarget = { scope: "device", track, chain: [], index: MIXER_INDEX, field: "parameter", parameter };
    this.add(ChangeKind.Changed, target, `${track.name} · ${what} ${words(was)} → ${words(now)}`, was, now);
  }

  private returnName(index: number, send: ParameterInfo): string {
    const returnTrack = this.from.returnTracks[index];
    return returnTrack ? SetWording.name(returnTrack) : send.name;
  }
}

/** Applies changes to a copy of a snapshot: changed values first, then removals, then additions. */
class SnapshotPatcher {
  private readonly set: SetSnapshot;
  /** Each change's track, found before anything moves. */
  private readonly owners = new Map<SetChange, TrackSnapshot>();
  /** Where each track of the snapshot was, in its list. */
  private readonly origins = new Map<TrackSnapshot, number>();
  /** The regular tracks as they were, for following group tracks. */
  private readonly firstTracks: readonly TrackSnapshot[];

  constructor(snapshot: SetSnapshot) {
    this.set = structuredClone(snapshot);
    this.firstTracks = [...this.set.tracks];
    this.set.tracks.forEach((track, index) => this.origins.set(track, index));
    this.set.returnTracks.forEach((track, index) => this.origins.set(track, index));
  }

  apply(changes: readonly SetChange[]): SetSnapshot {
    for (const change of changes) this.findOwner(change);
    for (const change of changes) if (change.kind === ChangeKind.Changed) this.changeValue(change);
    this.removeClips(changes);
    this.removeDevices(changes);
    this.removeTracks(changes);
    for (const change of changes) this.changeSong(change);
    this.changeSheet(changes);
    this.addTracks(changes);
    this.renumber();
    this.addClips(changes);
    this.addDevices(changes);
    this.setAddedSends(changes);
    return this.set;
  }

  private findOwner(change: SetChange): void {
    const target = change.target;
    if (target.scope === "song" || target.scope === "sheet") return;
    if (target.scope === "track" && target.field === "present" && change.kind === ChangeKind.Added) return;
    const track = target.track.list === TrackList.Main ? this.set.main : this.listOf(target.track.list)[target.track.index];
    if (track) this.owners.set(change, track);
  }

  private listOf(list: TrackList): TrackSnapshot[] {
    return list === TrackList.Returns ? this.set.returnTracks : this.set.tracks;
  }

  private everyTrack(): TrackSnapshot[] {
    return [...this.set.tracks, ...this.set.returnTracks, this.set.main];
  }

  private changeValue(change: SetChange): void {
    const target = change.target;
    const track = this.owners.get(change);
    if (!track || target.scope === "song" || target.scope === "sheet") return;
    if (target.scope === "track") {
      SnapshotPatcher.setTrackField(track, target.field, change.after);
    } else if (target.scope === "clip") {
      const clip = SnapshotPatcher.findClip(track, target.clip);
      if (clip) SnapshotPatcher.setClipField(clip, target.field, change.after);
    } else {
      SnapshotPatcher.setDeviceValue(track, target, change.after);
    }
  }

  private static setTrackField(track: TrackSnapshot, field: TrackField, value: unknown): void {
    if (field === "name" && typeof value === "string") track.name = value;
    else if (field === "mute" && typeof value === "boolean") track.mute = value;
    else if (field === "solo" && typeof value === "boolean") track.solo = value;
    else if (field === "arm" && typeof value === "boolean") track.arm = value;
    else if (field === "color" && typeof value === "number") track.color = value;
  }

  private static setClipField(clip: ClipInfo, field: ClipField, value: unknown): void {
    if (field === "notes" && Array.isArray(value)) clip.notes = structuredClone(value) as Note[];
    else if (field === "name" && typeof value === "string") clip.name = value;
    else if (field === "muted" && typeof value === "boolean") clip.muted = value;
    else if (field === "color" && typeof value === "number") clip.color = value;
    else if ((field === "loop" || field === "audio") && isRecord(value)) Object.assign(clip, structuredClone(value));
  }

  /** A parameter's value, or what changed in the device itself; only numbers are written into values. */
  private static setDeviceValue(track: TrackSnapshot, target: DeviceTarget, value: unknown): void {
    if (target.field === "parameter") {
      const index = target.parameter ?? -1;
      const mixer = target.index === MIXER_INDEX ? SnapshotPatcher.mixerAt(track, target.chain) : undefined;
      const parameter = target.index === MIXER_INDEX
        ? mixer && [mixer.volume, mixer.panning, ...mixer.sends][index]
        : SnapshotPatcher.findDevice(track, target.chain, target.index)?.parameters[index];
      if (parameter && typeof value === "number") parameter.value = value;
      return;
    }
    const device = SnapshotPatcher.findDevice(track, target.chain, target.index);
    if (device && isRecord(value)) SnapshotPatcher.reshape(device, value as unknown as DeviceSnapshot);
  }

  /** Takes the device's name, sample and chains from `after`; chains it already had keep their devices. */
  private static reshape(device: DeviceSnapshot, after: DeviceSnapshot): void {
    device.name = after.name;
    if (after.sample === undefined) delete device.sample;
    else device.sample = after.sample;
    if (!after.chains) {
      delete device.chains;
      return;
    }
    const kept = device.chains ?? [];
    device.chains = after.chains.map((chain, index) => {
      const existing = kept[index];
      const next: ChainSnapshot = existing ? { ...existing, index } : structuredClone(chain);
      if (chain.receivingNote === undefined) delete next.receivingNote;
      else next.receivingNote = chain.receivingNote;
      if (chain.mixer === undefined) delete next.mixer;
      else next.mixer = structuredClone(chain.mixer);
      return next;
    });
  }

  private static findClip(track: TrackSnapshot, place: ClipKey): ClipInfo | null {
    if ("slot" in place) return track.clipSlots[place.slot]?.clip ?? null;
    const start = place.start;
    const clips = place.lane === undefined ? track.arrangementClips : (track.takeLanes[place.lane]?.clips ?? []);
    return clips.find((clip) => clip.startTime === start) ?? null;
  }

  /** The devices of a track, or of the chain the path leads to. */
  private static deviceList(track: TrackSnapshot, chain: readonly number[]): DeviceSnapshot[] | undefined {
    let devices: DeviceSnapshot[] = track.devices;
    for (let step = 0; step + 1 < chain.length; step += 2) {
      const rack = chain[step];
      const inner = chain[step + 1];
      if (rack === undefined || inner === undefined) return undefined;
      const next = devices[rack]?.chains?.[inner];
      if (!next) return undefined;
      devices = next.devices;
    }
    return devices;
  }

  private static findDevice(track: TrackSnapshot, chain: readonly number[], index: number): DeviceSnapshot | undefined {
    return SnapshotPatcher.deviceList(track, chain)?.[index];
  }

  private static mixerAt(track: TrackSnapshot, path: readonly number[]): MixerInfo | undefined {
    if (path.length === 0) return track.mixer;
    const outer = SnapshotPatcher.deviceList(track, path.slice(0, -2));
    return outer?.[path[path.length - 2] ?? -1]?.chains?.[path[path.length - 1] ?? -1]?.mixer;
  }

  private static renumberDevices(devices: readonly DeviceSnapshot[]): void {
    devices.forEach((device, index) => (device.index = index));
  }

  private removeClips(changes: readonly SetChange[]): void {
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      if (change.kind !== ChangeKind.Removed || target.scope !== "clip" || !track) continue;
      const place = target.clip;
      if ("slot" in place) {
        const slot = track.clipSlots[place.slot];
        if (slot) slot.clip = null;
        continue;
      }
      const start = place.start;
      if (place.lane === undefined) {
        track.arrangementClips = track.arrangementClips.filter((clip) => clip.startTime !== start);
        continue;
      }
      const lane = track.takeLanes[place.lane];
      if (lane) lane.clips = lane.clips.filter((clip) => clip.startTime !== start);
    }
  }

  /** Innermost first and, within a list, last first, so every place still points where it did. */
  private removeDevices(changes: readonly SetChange[]): void {
    const removals: { track: TrackSnapshot; chain: readonly number[]; index: number }[] = [];
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      if (change.kind !== ChangeKind.Removed || target.scope !== "device" || target.index === MIXER_INDEX || !track) continue;
      removals.push({ track, chain: target.chain, index: target.index });
    }
    removals.sort((a, b) => b.chain.length - a.chain.length || b.index - a.index);
    for (const { track, chain, index } of removals) {
      const devices = SnapshotPatcher.deviceList(track, chain);
      if (!devices?.[index]) continue;
      devices.splice(index, 1);
      SnapshotPatcher.renumberDevices(devices);
    }
  }

  /** Removing a return track removes every track's send to it. */
  private removeTracks(changes: readonly SetChange[]): void {
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      if (change.kind !== ChangeKind.Removed || target.scope !== "track" || !track || target.track.list === TrackList.Main) continue;
      const tracks = this.listOf(target.track.list);
      const index = tracks.indexOf(track);
      if (index < 0) continue;
      if (target.track.list === TrackList.Returns) this.removeSends(index);
      tracks.splice(index, 1);
    }
  }

  /** Only tracks with one send per return track have a send to remove. */
  private removeSends(index: number): void {
    const count = this.set.returnTracks.length;
    for (const track of this.everyTrack()) {
      if (track.mixer.sends.length !== count) continue;
      track.mixer.sends.splice(index, 1);
      Sends.renumber(track);
    }
  }

  private changeSong(change: SetChange): void {
    const target = change.target;
    const value = change.after;
    if (target.scope !== "song") return;
    const song = this.set.song;
    if (target.field === "tempo" && typeof value === "number") {
      song.tempo = value;
    } else if (target.field === "key" && isRecord(value)) {
      const key = value as unknown as SongKey;
      song.rootNote = key.rootNote;
      song.scaleName = key.scaleName;
      song.scaleMode = key.scaleMode;
      song.scaleIntervals = [...key.scaleIntervals];
    } else if (target.field === "signature" && (value === null || isRecord(value))) {
      const signature = value as TimeSignature | null;
      this.set.signature = signature === null ? null : { numerator: signature.numerator, denominator: signature.denominator };
    } else if (target.field === "locators" && Array.isArray(value)) {
      song.locators = structuredClone(value) as LocatorInfo[];
    } else if (target.field === "scenes" && Array.isArray(value)) {
      const count = song.scenes.length;
      song.scenes = structuredClone(value) as SceneInfo[];
      this.resizeSlots(count, song.scenes.length);
    }
  }

  /**
   * The lyrics take the new text. Sections are added, removed or replaced and then ordered by start beat: replaced ones
   * keep their place among equal start beats and added ones follow in the order they came. The details are replaced;
   * settings, version and the lyrics revision stay.
   */
  private changeSheet(changes: readonly SetChange[]): void {
    const sheet = this.set.sheet;
    if (!sheet) return;
    let lyrics: string | null = null;
    let sections: Section[] | null = null;
    let details: SheetDetails | null = null;
    for (const change of changes) {
      const target = change.target;
      const value = change.after;
      if (target.scope !== "sheet") continue;
      if (target.field === "lyrics") {
        if (typeof value === "string") lyrics = value;
        continue;
      }
      if (target.field === "details") {
        if (isRecord(value)) details = structuredClone(value) as unknown as SheetDetails;
        continue;
      }
      const id = target.section;
      if (id === undefined) continue;
      sections ??= [...sheet.sections];
      const index = sections.findIndex((section) => section.id === id);
      if (change.kind === ChangeKind.Removed) {
        if (index >= 0) sections.splice(index, 1);
      } else if (isRecord(value)) {
        const section = structuredClone(value) as unknown as Section;
        if (index >= 0) sections[index] = section;
        else sections.push(section);
      }
    }
    if (lyrics === null && !sections && !details) return;
    const kept = { version: sheet.version, settings: sheet.settings, lyrics: sheet.lyrics, lyricsRevision: sheet.lyricsRevision, sections: sheet.sections };
    const next: LeadSheet = details ? { ...details, ...kept } : { ...sheet };
    if (lyrics !== null) next.lyrics = lyrics;
    if (sections) next.sections = sections.sort((a, b) => a.startBeat - b.startBeat);
    this.set.sheet = next;
  }

  /** Every track has one clip slot per scene. */
  private resizeSlots(before: number, after: number): void {
    if (before === after) return;
    for (const track of this.everyTrack()) {
      if (track.clipSlots.length !== before) continue;
      const slots = track.clipSlots;
      track.clipSlots = positions(after).map((slot) => slots[slot] ?? { slot, clip: null });
    }
  }

  /** Return tracks first, each giving every track a send to it; then regular tracks. */
  private addTracks(changes: readonly SetChange[]): void {
    for (const list of [TrackList.Returns, TrackList.Tracks]) {
      const added: { index: number; track: TrackSnapshot }[] = [];
      for (const change of changes) {
        const target = change.target;
        const value = change.after;
        if (change.kind !== ChangeKind.Added || target.scope !== "track" || target.track.list !== list || !isRecord(value)) continue;
        added.push({ index: target.track.index, track: structuredClone(value) as unknown as TrackSnapshot });
      }
      added.sort((a, b) => a.index - b.index);
      for (const { index, track } of added) {
        const tracks = this.listOf(list);
        const at = Math.min(index, tracks.length);
        if (list === TrackList.Returns) this.insertSends(at, track);
        tracks.splice(at, 0, track);
      }
    }
  }

  /** Only tracks with one send per return track get a send to a new one. */
  private insertSends(index: number, returnTrack: TrackSnapshot): void {
    const count = this.set.returnTracks.length;
    const fresh = Sends.fresh(returnTrack, index);
    for (const track of this.everyTrack()) {
      if (track.mixer.sends.length !== count) continue;
      track.mixer.sends.splice(index, 0, structuredClone(fresh));
      Sends.renumber(track);
    }
  }

  /** Tracks take their new positions; clip references and group tracks follow them. */
  private renumber(): void {
    const lists: [TrackList, TrackSnapshot[]][] = [
      [TrackList.Tracks, this.set.tracks],
      [TrackList.Returns, this.set.returnTracks],
    ];
    for (const [list, tracks] of lists) {
      tracks.forEach((track, index) => {
        const origin = this.origins.get(track);
        if (origin !== undefined && origin !== index) {
          SnapshotPatcher.moveClipReferences(track, SnapshotPatcher.trackRef(list, origin), SnapshotPatcher.trackRef(list, index));
        }
        track.index = index;
      });
    }
    for (const track of this.set.tracks) {
      if (!this.origins.has(track) || track.groupTrack === null) continue;
      const group = this.firstTracks[track.groupTrack];
      const index = group ? this.set.tracks.indexOf(group) : -1;
      track.groupTrack = index < 0 ? null : index;
    }
  }

  private static trackRef(list: TrackList, index: number): TrackRef {
    if (list === TrackList.Returns) return { returnIndex: index };
    if (list === TrackList.Main) return { main: true };
    return { index };
  }

  private static moveClipReferences(track: TrackSnapshot, from: TrackRef, to: TrackRef): void {
    const clips = [
      ...track.clipSlots.flatMap((slot) => (slot.clip ? [slot.clip] : [])),
      ...track.arrangementClips,
      ...track.takeLanes.flatMap((lane) => lane.clips),
    ];
    for (const clip of clips) {
      const ref = clip.ref;
      if ("track" in ref && Values.same(ref.track, from)) clip.ref = { ...ref, track: to };
    }
  }

  private addClips(changes: readonly SetChange[]): void {
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      const value = change.after;
      if (change.kind !== ChangeKind.Added || target.scope !== "clip" || !track || !isRecord(value)) continue;
      const clip = structuredClone(value) as unknown as ClipInfo;
      const place = target.clip;
      if ("slot" in place) {
        while (track.clipSlots.length <= place.slot) track.clipSlots.push({ slot: track.clipSlots.length, clip: null });
        const slot = track.clipSlots[place.slot];
        if (slot) slot.clip = clip;
        continue;
      }
      if (place.lane === undefined) {
        track.arrangementClips.push(clip);
        track.arrangementClips.sort((a, b) => a.startTime - b.startTime);
        continue;
      }
      while (track.takeLanes.length <= place.lane) track.takeLanes.push({ lane: track.takeLanes.length, name: "", clips: [] });
      const lane = track.takeLanes[place.lane];
      if (!lane) continue;
      lane.clips.push(clip);
      lane.clips.sort((a, b) => a.startTime - b.startTime);
    }
  }

  /** Outermost first and, within a list, first first, so every place already exists when it is used. */
  private addDevices(changes: readonly SetChange[]): void {
    const additions: { track: TrackSnapshot; chain: readonly number[]; index: number; device: DeviceSnapshot }[] = [];
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      const value = change.after;
      if (change.kind !== ChangeKind.Added || target.scope !== "device" || target.field !== "present" || !track || !isRecord(value)) continue;
      additions.push({ track, chain: target.chain, index: target.index, device: structuredClone(value) as unknown as DeviceSnapshot });
    }
    additions.sort((a, b) => a.chain.length - b.chain.length || a.index - b.index);
    for (const { track, chain, index, device } of additions) {
      const devices = SnapshotPatcher.deviceList(track, chain);
      if (!devices) continue;
      devices.splice(Math.min(index, devices.length), 0, device);
      SnapshotPatcher.renumberDevices(devices);
    }
  }

  /** Sends to added return tracks that were moved from where they start. */
  private setAddedSends(changes: readonly SetChange[]): void {
    for (const change of changes) {
      const target = change.target;
      const track = this.owners.get(change);
      const value = change.after;
      if (change.kind !== ChangeKind.Added || target.scope !== "device" || target.field !== "parameter" || target.index !== MIXER_INDEX) continue;
      const send = track && target.parameter !== undefined ? Sends.parameter(track, target.parameter) : undefined;
      if (send && typeof value === "number") send.value = value;
    }
  }
}

/** The item at a position the caller knows is there. */
function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`Position ${index} is out of range`);
  return item;
}

/** 0, 1, …, count − 1. */
function positions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
