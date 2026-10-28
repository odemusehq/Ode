import type { LiveConnections, Note } from "../shared/live";
import type { ClipInfo } from "../shared/live-ops";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import { ChangeKind, type ClipField, type SetChange, type SongField, type TrackField } from "../shared/versions";
import { LyricsText } from "../mneme/lyrics-text";
import { BEAT_TOLERANCE, SetLookup, type FoundClip } from "./set-lookup";
import type { SnapshotReader } from "./snapshot-reader";

/** A stretch of the Arrangement, in beats. */
interface Span {
  start: number;
  end: number;
}

/** A Session clip to launch: its track's place among the regular tracks, and its slot. */
interface Slot {
  track: number;
  slot: number;
}

/** Hearing a change: loop a stretch of the Arrangement and play it, or launch Session clips. */
type Playback = { loop: Span } | { fire: Slot[] };

/** A lyrics label ("[Chorus]" → "Chorus") and how many labels with the same name come before it in the text. */
interface Label {
  name: string;
  occurrence: number;
}

/** Changes you can't hear: playing them back would only waste the musician's time. */
const SILENT_CLIP_FIELDS: ReadonlySet<ClipField> = new Set(["name", "color"]);
const SILENT_TRACK_FIELDS: ReadonlySet<TrackField> = new Set(["name", "color", "arm"]);
const SILENT_SONG_FIELDS: ReadonlySet<SongField> = new Set(["locators", "scenes"]);

/** Lets the musician hear what Ode changed: loops the Arrangement bars a change touched and plays them, or launches the Session clips it changed. */
export class Listening {
  constructor(
    private readonly live: LiveConnections,
    private readonly reader: SnapshotReader,
  ) {}

  /**
   * Plays the changes: the Arrangement bars they touched (a bar earlier when they start a section); else the Session
   * clips they changed, launched; else, for changes you hear that have no bars (devices, mixer, mutes, tempo), the
   * selected clip on the first changed track, that track's first Arrangement clip, the selected clip, or the current
   * loop; else, for the lyrics, the section their first changed line is in, from the locator named like the label
   * above it ("[Chorus]" → "Chorus") to the next locator. Anything else (names, colours, the title) plays nothing.
   */
  async playChanged(changes: SetChange[]): Promise<void> {
    const snapshot = this.reader.latest;
    if (!snapshot || changes.length === 0 || !this.live.device.connected()) return;
    const playback = Listening.playbackFor(changes, new SetLookup(snapshot));
    if (!playback) return;
    if ("fire" in playback) {
      for (const { track, slot } of playback.fire) await this.live.device.call("clip_slot_fire", { track: { index: track }, slot });
      return;
    }
    const { start, end } = playback.loop;
    await this.live.device.call("loop_set", { on: true, start, length: end - start });
    await this.live.device.call("transport_play", { from: start });
  }

  private static playbackFor(changes: SetChange[], lookup: SetLookup): Playback | null {
    const bars = Listening.changedBars(changes, lookup);
    if (bars) return { loop: bars };
    const slots = Listening.changedSlots(changes, lookup);
    if (slots.length > 0) return { fire: slots };
    const audible = changes.filter((change) => Listening.isAudible(change));
    if (audible.length > 0) return Listening.clipToHear(audible, lookup) ?? { loop: Listening.currentLoop(lookup.snapshot) };
    const lyrics = Listening.lyricsSection(changes, lookup);
    return lyrics ? { loop: lyrics } : null;
  }

  private static changedBars(changes: SetChange[], lookup: SetLookup): Span | null {
    const spans = changes.flatMap((change) => Listening.spansOf(change, lookup));
    if (spans.length === 0) return null;
    const bar = lookup.beatsPerBar;
    let start = Math.floor(Math.min(...spans.map((span) => span.start)) / bar + BEAT_TOLERANCE) * bar;
    if (Listening.startsSection(start, lookup.snapshot)) start = Math.max(0, start - bar);
    const end = Math.max(Math.ceil(Math.max(...spans.map((span) => span.end)) / bar - BEAT_TOLERANCE) * bar, start + bar);
    return { start, end };
  }

  private static spansOf(change: SetChange, lookup: SetLookup): Span[] {
    const { target } = change;
    if (target.scope === "track" && target.field === "present" && change.kind === ChangeKind.Added) {
      const track = change.after as TrackSnapshot | undefined;
      return (track?.arrangementClips ?? []).map((clip) => ({ start: clip.startTime, end: clip.endTime }));
    }
    if (target.scope !== "clip" || !("start" in target.clip) || SILENT_CLIP_FIELDS.has(target.field)) return [];
    if (target.field === "present") {
      const clip = (change.kind === ChangeKind.Removed ? change.before : change.after) as ClipInfo | undefined;
      return Listening.isClip(clip) ? [{ start: clip.startTime, end: clip.endTime }] : [];
    }
    const track = lookup.trackByKey(target.track);
    const clip = track ? SetLookup.clipAt(track, target.clip) : undefined;
    if (!clip) return [{ start: target.clip.start, end: target.clip.start + lookup.beatsPerBar }];
    if (target.field !== "notes") return [{ start: clip.startTime, end: clip.endTime }];
    const changed = Listening.changedNotes(change.before, change.after);
    if (changed.length === 0) return [{ start: clip.startTime, end: clip.endTime }];
    return changed.map((note) => {
      const start = clip.startTime + (note.start - clip.startMarker);
      return { start: Math.max(clip.startTime, start), end: Math.min(clip.endTime, start + note.duration) };
    });
  }

  /** The Session clips the changes wrote or edited, each once. */
  private static changedSlots(changes: SetChange[], lookup: SetLookup): Slot[] {
    const slots = new Map<string, Slot>();
    for (const change of changes) {
      const slot = Listening.slotOf(change, lookup);
      if (slot) slots.set(`${slot.track} ${slot.slot}`, slot);
    }
    return [...slots.values()];
  }

  /** The Session clip a change wrote or edited (not one it removed), or the first Session clip of a track it added. */
  private static slotOf(change: SetChange, lookup: SetLookup): Slot | null {
    const { target } = change;
    let track: TrackSnapshot | undefined;
    let slot: number | undefined;
    if (target.scope === "track" && target.field === "present" && change.kind === ChangeKind.Added) {
      track = lookup.trackByKey(target.track);
      slot = track?.clipSlots.find((candidate) => candidate.clip)?.slot;
    } else if (target.scope === "clip" && "slot" in target.clip && !SILENT_CLIP_FIELDS.has(target.field)) {
      if (target.field === "present" && change.kind === ChangeKind.Removed) return null;
      track = lookup.trackByKey(target.track);
      slot = target.clip.slot;
    }
    const index = track ? lookup.snapshot.tracks.indexOf(track) : -1;
    return index >= 0 && slot !== undefined && track?.clipSlots[slot]?.clip ? { track: index, slot } : null;
  }

  /** Changes to the sound: devices, the mixer, mutes and solos, clips and tracks, tempo, key and time signature. */
  private static isAudible(change: SetChange): boolean {
    const { target } = change;
    switch (target.scope) {
      case "song":
        return !SILENT_SONG_FIELDS.has(target.field);
      case "track":
        return !SILENT_TRACK_FIELDS.has(target.field);
      case "clip":
        return !SILENT_CLIP_FIELDS.has(target.field);
      case "device":
        return true;
      case "sheet":
        return false;
    }
  }

  /** True when a section starts at this beat: a locator, or a section of the lead sheet. */
  private static startsSection(beat: number, snapshot: SetSnapshot): boolean {
    if (beat <= 0) return false;
    const starts = [...snapshot.song.locators.map((locator) => locator.time), ...(snapshot.sheet?.sections ?? []).map((section) => section.startBeat)];
    return starts.some((start) => Math.abs(start - beat) <= BEAT_TOLERANCE);
  }

  /**
   * For changes with no bars: the selected clip when it is on the first changed track (or no track changed), otherwise
   * the first Arrangement clip of that track, otherwise the selected clip.
   */
  private static clipToHear(changes: SetChange[], lookup: SetLookup): Playback | null {
    const ref = lookup.snapshot.selection.clip;
    const selected = ref ? lookup.clip(ref) : undefined;
    const changedTrack = Listening.firstChangedTrack(changes, lookup);
    if (selected && (!changedTrack || selected.track === changedTrack)) return Listening.playbackOf(selected, lookup);
    const first = changedTrack ? [...changedTrack.arrangementClips].sort((a, b) => a.startTime - b.startTime)[0] : undefined;
    if (first) return { loop: Listening.barsOf(first, lookup) };
    return selected ? Listening.playbackOf(selected, lookup) : null;
  }

  /** An Arrangement clip's bars, looped; a Session clip, launched. */
  private static playbackOf(found: FoundClip, lookup: SetLookup): Playback | null {
    if (found.arranged) return { loop: Listening.barsOf(found.clip, lookup) };
    const track = lookup.snapshot.tracks.indexOf(found.track);
    const slot = found.track.clipSlots.find((candidate) => candidate.clip === found.clip)?.slot;
    return track >= 0 && slot !== undefined ? { fire: [{ track, slot }] } : null;
  }

  /** The track of the first change that is on a track, as it is now. */
  private static firstChangedTrack(changes: SetChange[], lookup: SetLookup): TrackSnapshot | undefined {
    for (const { target } of changes) {
      if (target.scope === "track" || target.scope === "clip" || target.scope === "device") return lookup.trackByKey(target.track);
    }
    return undefined;
  }

  /** A clip's bars, from the bar it starts in to the bar it ends in. */
  private static barsOf(clip: ClipInfo, lookup: SetLookup): Span {
    const bar = lookup.beatsPerBar;
    const start = Math.floor(clip.startTime / bar + BEAT_TOLERANCE) * bar;
    return { start, end: Math.max(Math.ceil(clip.endTime / bar - BEAT_TOLERANCE) * bar, start + bar) };
  }

  private static currentLoop(snapshot: SetSnapshot): Span {
    const { start, length } = snapshot.transport.loop;
    return { start, end: start + length };
  }

  /**
   * The section of a lyrics change: from the locator named like the label above the first changed line (case ignored;
   * the second "[Chorus]" in the text goes with the second "Chorus" locator when there is one) to the next locator, or
   * to the end of the Arrangement after the last one. None when there is no such label or locator.
   */
  private static lyricsSection(changes: SetChange[], lookup: SetLookup): Span | null {
    const change = changes.find(({ target }) => target.scope === "sheet" && target.field === "lyrics");
    if (!change) return null;
    const label = Listening.labelAbove(Listening.textOf(change.before), Listening.textOf(change.after));
    if (!label) return null;
    const locators = [...lookup.snapshot.song.locators].sort((a, b) => a.time - b.time);
    const named = locators.filter((locator) => locator.name.trim().toLowerCase() === label.name.toLowerCase());
    const locator = named[label.occurrence] ?? named[0];
    if (!locator) return null;
    const next = locators.find((other) => other.time > locator.time + BEAT_TOLERANCE);
    const end = next?.time ?? Listening.arrangementEnd(lookup);
    return end > locator.time + BEAT_TOLERANCE ? { start: locator.time, end } : null;
  }

  /** The label line above the first line that differs between the two texts (the line itself when it is a label). */
  private static labelAbove(before: string, after: string): Label | null {
    const earlier = LyricsText.lines(before);
    const later = LyricsText.lines(after);
    const length = Math.max(earlier.length, later.length);
    let first = 0;
    while (first < length && earlier[first] === later[first]) first += 1;
    if (first === length || later.length === 0) return null;
    for (let index = Math.min(first, later.length - 1); index >= 0; index -= 1) {
      const line = later[index] ?? "";
      if (!LyricsText.isLabel(line)) continue;
      const name = Listening.labelName(line);
      const occurrence = later.slice(0, index).filter((other) => LyricsText.isLabel(other) && Listening.labelName(other).toLowerCase() === name.toLowerCase()).length;
      return name ? { name, occurrence } : null;
    }
    return null;
  }

  /** "[Chorus]" → "Chorus". */
  private static labelName(line: string): string {
    return line.trim().slice(1, -1).trim();
  }

  private static textOf(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  /** Where the last Arrangement clip ends, in beats. */
  private static arrangementEnd(lookup: SetLookup): number {
    const ends = lookup.allTracks.flatMap((track) => SetLookup.arrangedClips(track).map((clip) => clip.endTime));
    return ends.length > 0 ? Math.max(...ends) : 0;
  }

  /** Notes in one list and not the other: what was added, moved or removed. */
  private static changedNotes(before: unknown, after: unknown): Note[] {
    const earlier = Array.isArray(before) ? (before as Note[]) : [];
    const later = Array.isArray(after) ? (after as Note[]) : [];
    const remaining = new Map<string, number>();
    for (const note of earlier) remaining.set(Listening.noteKey(note), (remaining.get(Listening.noteKey(note)) ?? 0) + 1);
    const added = later.filter((note) => {
      const key = Listening.noteKey(note);
      const count = remaining.get(key) ?? 0;
      if (count === 0) return true;
      remaining.set(key, count - 1);
      return false;
    });
    const removed = earlier.filter((note) => {
      const key = Listening.noteKey(note);
      const count = remaining.get(key) ?? 0;
      if (count === 0) return false;
      remaining.set(key, count - 1);
      return true;
    });
    return [...added, ...removed];
  }

  private static noteKey(note: Note): string {
    return JSON.stringify([note.pitch, note.start, note.duration, note.velocity, note.muted, note.probability]);
  }

  private static isClip(value: unknown): value is ClipInfo {
    const clip = value as Partial<ClipInfo> | undefined;
    return typeof clip?.startTime === "number" && typeof clip.endTime === "number";
  }
}
