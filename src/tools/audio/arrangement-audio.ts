import { rm } from "node:fs/promises";
import { TAG_SEPARATOR } from "../../shared/live";
import type { TrackRef } from "../../shared/live";
import type { ExtensionOpArgs, ExtensionOpResults, SongInfo, TrackKind, TrackSummary } from "../../shared/live-ops";
import type { ToolContext } from "../define";

/** Why a track of each kind cannot be rendered; null when it can. */
const RENDER_LIMITS: Readonly<Record<TrackKind, string | null>> = {
  audio: null,
  midi: "MIDI track: only Arrangement audio tracks can be rendered. Freeze and flatten it, or resample it onto an audio track, then check again.",
  group: "group track: check the audio tracks inside it instead.",
  return: "return track: only Arrangement audio tracks can be rendered.",
  main: "Main track: check the audio tracks that feed it instead.",
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
  private songInfo: SongInfo | null = null;

  constructor(private readonly ctx: ToolContext) {}

  /** Tempo, key, scale and tracks of the Set (read once). */
  async song(): Promise<SongInfo> {
    this.songInfo ??= await this.ctx.live.extension.call<ExtensionOpResults["song_get"]>("song_get", {});
    return this.songInfo;
  }

  /** The track a reference points at when it can be rendered; otherwise the reason it cannot. */
  async resolve(ref: TrackRef): Promise<TrackLookup> {
    if ("main" in ref) return { skipped: { track: "Main", reason: RENDER_LIMITS.main ?? "" } };
    const track = findTrack(await this.song(), ref);
    if (!track) return { skipped: { track: describeTrackRef(ref), reason: "not found in the Set" } };
    const reason = RENDER_LIMITS[track.kind];
    if (reason) return { skipped: { track: track.name, reason } };
    return { track: { ref: { index: track.index }, name: track.name } };
  }

  /**
   * Renders a track's Arrangement audio (before its devices) for a range of beats and hands the file to `use`; the
   * render is deleted once `use` is done, so the temp folder keeps only what Ode still needs.
   */
  async withRender<T>(track: TrackRef, start: number, end: number, use: (path: string) => Promise<T>): Promise<T> {
    const args: ExtensionOpArgs["render_track_audio"] = { track, start, end };
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
function findTrack(song: SongInfo, ref: TrackRef): TrackSummary | undefined {
  if ("returnIndex" in ref) return song.returnTracks.find((track) => track.index === ref.returnIndex);
  if ("index" in ref) return song.tracks.find((track) => track.index === ref.index);
  const all = [...song.tracks, ...song.returnTracks];
  if ("tag" in ref) return all.find((track) => track.tag === ref.tag);
  if ("name" in ref) {
    const wanted = baseName(ref.name);
    return all.find((track) => track.name === wanted) ?? all.find((track) => track.name.toLowerCase() === wanted.toLowerCase());
  }
  return undefined;
}

/** A track name as the musician sees it, with Ode's tag taken off ("Vocals ·ab12" → "Vocals"). */
function baseName(name: string): string {
  return (name.split(TAG_SEPARATOR)[0] ?? name).trim();
}

function describeTrackRef(ref: TrackRef): string {
  if ("name" in ref) return ref.name;
  if ("index" in ref) return `track index ${ref.index}`;
  if ("tag" in ref) return `track tagged ${ref.tag}`;
  if ("returnIndex" in ref) return `return track index ${ref.returnIndex}`;
  return "Main";
}
