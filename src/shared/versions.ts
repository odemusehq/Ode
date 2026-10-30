// The version history of the whole Set: what changed between two snapshots, and who changed it.
import type { LeadSheet } from "./song";
import type { RecoveryReceipt } from "./mutation-receipt";

export enum VersionAuthor {
  Musician = "musician",
  Ode = "ode",
  Observed = "observed",
}

export enum ChangeKind {
  Added = "added",
  Removed = "removed",
  Changed = "changed",
}

export enum TrackList {
  Tracks = "tracks",
  Returns = "returns",
  Main = "main",
}

/** A track by its place in the snapshot the change starts from (an added track: the snapshot it ends in). */
export interface TrackKey {
  list: TrackList;
  index: number;
  name: string;
  tag?: string;
}

/** A clip by where it sits: a Session slot, or an Arrangement start on the main lane or a take lane. */
export type ClipKey = { slot: number } | { start: number; lane?: number };

export type SongField = "tempo" | "key" | "signature" | "locators" | "scenes";
export type TrackField = "present" | "name" | "mute" | "solo" | "arm" | "color";
export type ClipField = "present" | "notes" | "name" | "muted" | "color" | "loop" | "audio";
export type DeviceField = "present" | "parameter";
/** The lead sheet: the lyrics text, one section (its chords, name or place), or everything else in it. */
export type SheetField = "lyrics" | "section" | "details";

/** The lead sheet without its lyrics, sections and the musician's settings: title, intent, links, locks, credits, notes. */
export type SheetDetails = Omit<LeadSheet, "lyrics" | "lyricsRevision" | "sections" | "version" | "settings">;

/**
 * What a change applies to. Devices are addressed like DeviceRef: chain pairs from the track inwards,
 * then the device index; index MIXER_INDEX with a parameter is the track's mixer (0 volume, 1 pan, 2+ sends).
 */
export type ChangeTarget =
  | { scope: "song"; field: SongField }
  | { scope: "track"; track: TrackKey; field: TrackField }
  | { scope: "clip"; track: TrackKey; clip: ClipKey; field: ClipField }
  | { scope: "device"; track: TrackKey; chain: number[]; index: number; field: DeviceField; parameter?: number }
  /** The lyrics (before and after are the texts), a section by its id (Sections), or the SheetDetails. */
  | { scope: "sheet"; field: SheetField; section?: string };

/** One difference between two snapshots, with both sides so it can be shown and undone. */
export interface SetChange {
  kind: ChangeKind;
  target: ChangeTarget;
  /** Plain words: "Bass · notes in bars 9–16", "Pad · EQ Eight Frequency A 120 Hz → 200 Hz". */
  label: string;
  before?: unknown;
  after?: unknown;
}

export interface Version {
  id: string;
  time: string;
  author: VersionAuthor;
  name?: string;
  /** One line: Ode's result line, or "You · 12 edits on Drums and Pad". */
  summary: string;
  /** Ode's versions: what the musician asked for (a typed line or a tapped suggestion), so Again can retry it. */
  request?: string;
  changes: SetChange[];
  /** Writer receipts support scoped recovery; the full snapshot delta may also contain hand edits. */
  recovery?: RecoveryReceipt;
}

/** A version as the History list shows it. */
export interface VersionListItem extends Omit<Version, "changes" | "recovery"> {
  tracks: string[];
  changeCount: number;
  /** Full receipts remain in version detail, rather than copying note arrays into every list/event. */
  scopedUndo: boolean;
}

/** A version opened in History: its changes by track, so the touched tracks can be highlighted with how they were. */
export interface VersionDetail {
  version: Version;
  tracks: { track: string; changes: SetChange[] }[];
  song: SetChange[];
  /** Quarter-note beats per bar in the Set at this version, for drawing its notes. */
  beatsPerBar: number | null;
}

export interface RestoreResult {
  restored: boolean;
  /** What the restore skipped, in plain words (plugin state, automation, a missing file). */
  skipped: string[];
}
