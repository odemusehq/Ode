import { rm } from "node:fs/promises";
import { TAG_SEPARATOR } from "../../shared/live";
import type { TrackRef } from "../../shared/live";
import type { ExtensionOpArgs, ExtensionOpResults, SongInfo, TrackKind, TrackSummary } from "../../shared/live-ops";
import type { ToolContext } from "../define";

/** Why a track of each kind is skipped by the render; null for a kind that renders. */
const RENDER_LIMITS: Readonly<Record<TrackKind, string | null>> = {
  audio: null,
  midi: "MIDI track: only Arrangement audio tracks can be rendered. Freeze and flatten it, or resample it onto an audio track, then check again.",
  group: "group track: check the audio tracks inside it.",
  return: "return track: only Arrangement audio tracks can be rendered.",
  main: "Main track: check the audio tracks that feed it.",
};

export interface RenderableTrack {
  ref: TrackRef;
  name: string;
}

export interface SkippedTrack {
  track: string;
  reason: string;
}

export type TrackLookup = { track: RenderableTrack } | { skipped: SkippedTrack };

/** Reads the Set and renders Arrangement audio tracks through the Ode extension. */
export class ArrangementAudio {
  constructor(private readonly ctx: ToolContext) {}

  /** Fresh metadata: manual structural edits must not leave later captures using an old index. */
  async song(): Promise<SongInfo> {
    return this.ctx.live.extension.call<ExtensionOpResults["song_get"]>("song_get", {});
  }

  /** The track a reference points at when it renders; otherwise the reason it is skipped. */
  async resolve(ref: TrackRef): Promise<TrackLookup> {
    if ("main" in ref) return { skipped: { track: "Main", reason: RENDER_LIMITS.main ?? "" } };
    const song = await this.song();
    const found = findTrack(song, ref);
    if ("reason" in found) return { skipped: { track: describeTrackRef(ref), reason: found.reason } };
    const track = found.track;
    const reason = RENDER_LIMITS[track.kind];
    if (reason) return { skipped: { track: track.name, reason } };
    const all = [...song.tracks, ...song.returnTracks];
    // Even an explicitly selected index is converted to an unambiguous identity before asynchronous capture.
    if (track.tag && all.filter((candidate) => candidate.tag === track.tag).length === 1) return { track: { ref: { tag: track.tag }, name: track.name } };
    const name = fullName(track);
    if (all.filter((candidate) => fullName(candidate) === name).length !== 1) return { skipped: { track: track.name, reason: "ambiguous track identity; give the intended track a unique name or tag before capturing it" } };
    return { track: { ref: { name }, name: track.name } };
  }

  /**
   * Renders a track's Arrangement audio (before its devices) for a range of beats and hands the file to `use`; the
   * render is deleted once `use` is done, so the temp folder keeps only what Ode still needs.
   */
  async withRender<T>(track: TrackRef, start: number, end: number, use: (path: string) => Promise<T>): Promise<T> {
    requireRange(start, end);
    const resolved = await this.resolve(track);
    if ("skipped" in resolved) throw new Error(`${resolved.skipped.track} stays unrendered: ${resolved.skipped.reason}`);
    const args: ExtensionOpArgs["render_track_audio"] = { track: resolved.track.ref, start, end };
    const { path } = await this.ctx.live.extension.call<ExtensionOpResults["render_track_audio"]>("render_track_audio", args);
    try {
      return await use(path);
    } finally {
      await rm(path, { force: true });
    }
  }
}

/** Throws a plain error unless end comes after start. */
export function requireRange(start: number, end: number): void {
  if (!(end > start)) throw new Error(`end (${end}) must be after start (${start}), both in beats`);
}

/** Finds a track the way the extension does: return tracks included, so their reason shows; a name matches without Ode's tag, in any case. */
function findTrack(song: SongInfo, ref: TrackRef): { track: TrackSummary } | { reason: string } {
  const unique = (tracks: TrackSummary[]) => tracks.length === 1 ? { track: tracks[0]! } : { reason: tracks.length ? "ambiguous name or tag; identify one track before rendering" : "missing from the Set" };
  if ("returnIndex" in ref) return unique(song.returnTracks.filter((track) => track.index === ref.returnIndex));
  if ("index" in ref) return unique(song.tracks.filter((track) => track.index === ref.index));
  const all = [...song.tracks, ...song.returnTracks];
  if ("tag" in ref) return unique(all.filter((track) => track.tag === ref.tag));
  if ("name" in ref) {
    const tagged = all.filter((track) => track.tag && fullName(track) === ref.name);
    if (tagged.length) return unique(tagged);
    const exact = all.filter((track) => track.name === ref.name);
    if (exact.length) return unique(exact);
    return unique(all.filter((track) => fullName(track).toLowerCase() === ref.name.toLowerCase() || track.name.toLowerCase() === ref.name.toLowerCase()));
  }
  return { reason: "Main track audio cannot be rendered by this SDK" };
}

function fullName(track: TrackSummary): string { return track.tag ? `${track.name}${TAG_SEPARATOR}${track.tag}` : track.name; }

function describeTrackRef(ref: TrackRef): string {
  if ("name" in ref) return ref.name;
  if ("index" in ref) return `track index ${ref.index}`;
  if ("tag" in ref) return `track tagged ${ref.tag}`;
  if ("returnIndex" in ref) return `return track index ${ref.returnIndex}`;
  return "Main";
}
