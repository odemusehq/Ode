import type { LiveConnections, Note } from "../shared/live";
import type { ClipInfo } from "../shared/live-ops";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { Section } from "../shared/song";
import { ChangeKind, type ClipField, type SetChange } from "../shared/versions";
import { BEAT_TOLERANCE, SetLookup } from "./set-lookup";
import type { SnapshotReader } from "./snapshot-reader";

/** A stretch of the Arrangement, in beats. */
interface Span {
  start: number;
  end: number;
}

/** Clip changes you can't hear: playing them back would only waste the musician's time. */
const SILENT_CLIP_FIELDS: ReadonlySet<ClipField> = new Set(["name", "color"]);

/** Lets the musician hear what Ode changed: loops the Arrangement bars a change touched and plays them. */
export class Listening {
  constructor(
    private readonly live: LiveConnections,
    private readonly reader: SnapshotReader,
  ) {}

  /**
   * Loops from the earliest to the latest bar the changes touched (a bar earlier when they start a section)
   * and plays. Changes with no bars (devices, mixer) loop the selected clip when it is on the first changed
   * track, otherwise that track's first Arrangement clip, otherwise the selected clip, or else the current loop.
   */
  async playChanged(changes: SetChange[]): Promise<void> {
    const snapshot = this.reader.latest;
    if (!snapshot || changes.length === 0 || !this.live.device.connected()) return;
    const lookup = new SetLookup(snapshot);
    const loop = this.changedBars(changes, lookup) ?? Listening.clipBars(changes, lookup) ?? Listening.currentLoop(snapshot);
    await this.live.device.call("loop_set", { on: true, start: loop.start, length: loop.end - loop.start });
    await this.live.device.call("transport_play", { from: loop.start });
  }

  private changedBars(changes: SetChange[], lookup: SetLookup): Span | null {
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
    if (target.scope === "sheet") {
      if (target.field !== "section") return [];
      const section = (change.kind === ChangeKind.Removed ? change.before : change.after) as Section | undefined;
      return Listening.isSection(section) ? [{ start: section.startBeat, end: section.startBeat + section.lengthBeats }] : [];
    }
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

  /** True when a section starts at this beat: a locator, or a section of the lead sheet. */
  private static startsSection(beat: number, snapshot: SetSnapshot): boolean {
    if (beat <= 0) return false;
    const starts = [...snapshot.song.locators.map((locator) => locator.time), ...(snapshot.sheet?.sections ?? []).map((section) => section.startBeat)];
    return starts.some((start) => Math.abs(start - beat) <= BEAT_TOLERANCE);
  }

  /**
   * For changes with no bars: the selected Arrangement clip when it is on the first changed track (or no track
   * changed), otherwise the first Arrangement clip of that track, otherwise the selected clip.
   */
  private static clipBars(changes: SetChange[], lookup: SetLookup): Span | null {
    const ref = lookup.snapshot.selection.clip;
    const found = ref ? lookup.clip(ref) : undefined;
    const selected = found?.arranged ? found : undefined;
    const changedTrack = Listening.firstChangedTrack(changes, lookup);
    if (selected && (!changedTrack || selected.track === changedTrack)) return Listening.barsOf(selected.clip, lookup);
    const first = changedTrack ? [...changedTrack.arrangementClips].sort((a, b) => a.startTime - b.startTime)[0] : undefined;
    if (first) return Listening.barsOf(first, lookup);
    return selected ? Listening.barsOf(selected.clip, lookup) : null;
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

  private static isSection(value: unknown): value is Section {
    const section = value as Partial<Section> | undefined;
    return typeof section?.startBeat === "number" && typeof section.lengthBeats === "number";
  }
}
