import type { ClipRef, ClipSlotRef, DeviceRef, LiveConnections, LivePointer, TrackRef } from "../shared/live";
import type { ClipInfo, SelectionInfo } from "../shared/live-ops";
import type { SetSnapshot } from "../shared/set-snapshot";
import type { Suggestion, UiEvent } from "../shared/events";
import type { SongVersions } from "../mneme/song-store";
import { SetLookup } from "./set-lookup";
import type { SnapshotReader } from "./snapshot-reader";
import type { SuggestionFinder } from "./suggestions";

export interface SelectionDeps {
  live: LiveConnections;
  reader: SnapshotReader;
  versions: SongVersions;
  finder: SuggestionFinder;
  /** True while Ode works on a request; the Set isn't read for the selection then. */
  busy: () => boolean;
  emit: (event: UiEvent) => void;
}

/** What a right-click "Ode…" target can hold (see the extension's pointers). */
interface PointerTarget {
  clip?: ClipRef;
  slot?: ClipSlotRef;
  slots?: ClipSlotRef[];
  track?: TrackRef;
  tracks?: TrackRef[];
  device?: DeviceRef;
}

/**
 * What the musician is on in Live: the selection the Ode device follows, or what they pointed at with
 * "Ode…". Shown in words with its one-tap suggestions.
 */
export class SelectionState {
  static readonly WHOLE_SONG = "Whole song";
  private selection: SelectionInfo | null = null;
  private label = SelectionState.WHOLE_SONG;
  private items: Suggestion[] = [];
  private pointedAt: LivePointer | null = null;
  private pointerIsLatest = false;
  private shown = 0;

  constructor(private readonly deps: SelectionDeps) {}

  /** What was pointed at with "Ode…", until the musician selects something else in Live. */
  get pointer(): LivePointer | null {
    return this.pointerIsLatest ? this.pointedAt : null;
  }

  /** The Ode device reported a new selection. */
  async select(selection: SelectionInfo): Promise<void> {
    this.pointerIsLatest = false;
    await this.show(selection);
  }

  /** The musician right-clicked something in Live and chose "Ode…". */
  async point(pointer: LivePointer): Promise<void> {
    this.pointedAt = pointer;
    this.pointerIsLatest = true;
    await this.show(SelectionState.fromPointer(pointer, this.selection));
  }

  /** Works the suggestions out again, for example after Ode changed the Set. */
  async refresh(): Promise<void> {
    if (this.selection) await this.show(this.selection);
  }

  /** The suggestions for what the musician is on now. */
  async suggestions(): Promise<Suggestion[]> {
    if (this.selection) {
      await this.show(this.selection);
      return this.items;
    }
    const { device } = this.deps.live;
    if (!device.connected()) return [];
    try {
      await this.show(await device.call<SelectionInfo>("selection_get", {}));
    } catch {
      return [];
    }
    return this.items;
  }

  /** Sends what the musician is on to a UI that just connected. */
  replay(send: (event: UiEvent) => void): void {
    if (!this.selection) return;
    send({ type: "selection", selection: this.selection, label: this.label });
    send({ type: "suggestions", items: this.items });
  }

  /** In words, e.g. "Bass · clip Bass A · bars 9–16"; "Whole song" when nothing is selected. */
  static describe(selection: SelectionInfo, snapshot: SetSnapshot): string {
    const lookup = new SetLookup(snapshot);
    const found = selection.clip ? lookup.clip(selection.clip) : undefined;
    if (found) {
      const clip = found.clip.name ? `clip ${found.clip.name}` : "clip";
      const place = found.arranged
        ? lookup.barsLabel(found.clip.startTime, found.clip.endTime)
        : lookup.lengthLabel(SelectionState.sessionLength(found.clip));
      return `${found.track.name} · ${clip} · ${place}`;
    }
    const track = selection.track ? lookup.track(selection.track) : undefined;
    return track ? track.name : SelectionState.WHOLE_SONG;
  }

  private async show(selection: SelectionInfo): Promise<void> {
    const shown = ++this.shown;
    this.selection = selection;
    const snapshot = await this.snapshotFor(selection);
    if (shown !== this.shown) return;
    const pointer = this.pointer;
    this.label = pointer ? pointer.description : snapshot ? SelectionState.describe(selection, snapshot) : SelectionState.roughLabel(selection);
    this.deps.emit({ type: "selection", selection, label: this.label });
    const items = snapshot ? await this.deps.finder.for(selection, snapshot) : [];
    if (shown !== this.shown) return;
    this.items = items;
    this.deps.emit({ type: "suggestions", items });
  }

  /** The latest snapshot when it holds what is selected; otherwise the Set is read again (unless Ode is working). */
  private async snapshotFor(selection: SelectionInfo): Promise<SetSnapshot | null> {
    const known = this.deps.reader.latest ?? (await this.deps.versions.history.latest().catch(() => null));
    if (known && SelectionState.holds(known, selection)) return known;
    const { extension, device } = this.deps.live;
    if (this.deps.busy() || !extension.connected() || !device.connected()) return known;
    try {
      return await this.deps.reader.read();
    } catch {
      return known;
    }
  }

  private static holds(snapshot: SetSnapshot, selection: SelectionInfo): boolean {
    const lookup = new SetLookup(snapshot);
    if (selection.clip && !lookup.clip(selection.clip)) return false;
    return !selection.track || lookup.track(selection.track) !== undefined;
  }

  /** A Session clip's length: its loop when it loops, otherwise from its start marker to its end marker. */
  private static sessionLength(clip: ClipInfo): number {
    return clip.looping ? clip.loopEnd - clip.loopStart : clip.endMarker - clip.startMarker;
  }

  /** Words for a selection when no snapshot is at hand yet. */
  private static roughLabel(selection: SelectionInfo): string {
    if (!selection.track) return SelectionState.WHOLE_SONG;
    const ref = selection.track;
    let track: string;
    if ("index" in ref) track = `Track ${ref.index + 1}`;
    else if ("returnIndex" in ref) track = `Return track ${ref.returnIndex + 1}`;
    else if ("main" in ref) track = "Main";
    else if ("name" in ref) track = ref.name;
    else track = "Track";
    return selection.clip ? `${track} · clip` : track;
  }

  /** The selection a pointer stands for: its clip or clip slot, its track, or the first of several. */
  private static fromPointer(pointer: LivePointer, previous: SelectionInfo | null): SelectionInfo {
    const target = (pointer.target ?? {}) as PointerTarget;
    const slot = target.slot ?? target.slots?.[0];
    const clip: ClipRef | null = target.clip ?? slot ?? null;
    const clipTrack = clip && "track" in clip ? clip.track : null;
    const track = clipTrack ?? target.track ?? target.device?.track ?? target.tracks?.[0] ?? null;
    return {
      track,
      clip,
      scene: previous?.scene ?? null,
      time: previous?.time ?? null,
      isPlaying: previous?.isPlaying ?? false,
    };
  }
}
