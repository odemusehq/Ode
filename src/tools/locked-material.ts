import { TaggedName } from "../live/extension/tags";
import { LyricsText } from "../mneme/lyrics-text";
import { SetLookup } from "../server/set-lookup";
import { TAG_SEPARATOR, type ClipRef, type TrackRef } from "../shared/live";
import { LyricsSections, type LyricsSection } from "../shared/lyrics-sections";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";

const key = (text: string) => text.trim().replace(/^\[|\]$/g, "").trim().toLowerCase();
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** These operations read existing material or copy it without editing the source, including inside a batch. */
const SOURCE_ONLY = new Set([
  "song_get", "track_get", "take_lane_get", "clip_slot_get", "clip_get", "midi_clip_get_notes", "audio_clip_get",
  "device_get", "parameter_get", "mixer_get", "rack_get_chains", "simpler_get_sample", "scene_get",
  "render_track_audio", "import_into_project", "song_duplicate_track",
]);

/** Enforce identifiable locks on validated arguments (including batch children). Free-text intent still needs interpretation. */
export function assertUnlocked(name: string, input: unknown, snapshot: SetSnapshot): void {
  if (SOURCE_ONLY.has(name) || !isObject(input)) return;
  const locked = new Set((snapshot.sheet?.locked ?? []).map(key).filter(Boolean));
  if (locked.size === 0) return;
  const protectedLinks = (snapshot.sheet?.links ?? []).filter((link) => locked.has(key(link.role)));
  for (const link of protectedLinks) locked.add(key(link.tag));
  const lookup = new SetLookup(snapshot);
  const protects = (object: { name: string; tag?: string }) => locked.has(key(object.name)) || Boolean(object.tag &&
    (locked.has(key(object.tag)) || locked.has(key(`${object.name}${TAG_SEPARATOR}${object.tag}`))));
  const refuse = (label: string): never => { throw new Error(`${label} is locked. Keep it unchanged, or ask the musician to unlock it before editing.`); };

  if (name === "apply_as_one_undo_step" && Array.isArray(input.calls)) {
    for (const call of input.calls) if (isObject(call) && typeof call.op === "string") assertUnlocked(call.op, call.args, snapshot);
    return;
  }
  if (name === "song_delete_track" && isObject(input.track)) {
    const track = lookup.track(input.track as TrackRef);
    const removed = new Set<TrackSnapshot>(track ? [track] : []);
    // Deleting a group also removes its nested tracks and their material.
    for (let changed = true; changed;) {
      changed = false;
      for (const candidate of snapshot.tracks) {
        const parent = candidate.groupTrack === null ? undefined : snapshot.tracks[candidate.groupTrack];
        if (parent && removed.has(parent) && !removed.has(candidate)) { removed.add(candidate); changed = true; }
      }
    }
    for (const target of removed) if (protects(target) || SetLookup.clipsOf(target).some(protects)) refuse(target.name);
  }
  if (name === "track_clear_range" && isObject(input.track) && typeof input.start === "number" && typeof input.end === "number") {
    const track = lookup.track(input.track as TrackRef);
    const { start, end } = input;
    const clip = track && SetLookup.arrangedClips(track).find((clip) => clip.startTime < end && clip.endTime > start && protects(clip));
    if (track && clip) refuse(`${track.name} · ${clip.name}`);
  }
  if (name === "song_delete_scene" && isObject(input.scene)) {
    const scene = input.scene;
    const names = (item: { name: string }) => [item.name, TaggedName.parse(item.name).name];
    const index = typeof scene.index === "number" ? scene.index : snapshot.song.scenes.findIndex((item) => names(item).includes(scene.name as string));
    const resolved = index >= 0 ? index : typeof scene.name === "string"
      ? snapshot.song.scenes.findIndex((item) => names(item).some((name) => name.toLowerCase() === (scene.name as string).toLowerCase())) : -1;
    if (resolved >= 0) for (const track of lookup.allTracks) {
      const clip = track.clipSlots[resolved]?.clip;
      if (protects(track) || clip && protects(clip)) refuse(clip ? `${track.name} · ${clip.name}` : track.name);
    }
  }

  const inspect = (value: unknown, field = "") => {
    if (Array.isArray(value)) { value.forEach((item) => inspect(item, field)); return; }
    if (!isObject(value)) return;
    if (field === "track") {
      const track = lookup.track(value as TrackRef);
      if (track && protects(track)) refuse(track.name);
    }
    if (field === "clip" || field === "slot") {
      const found = lookup.clip(value as ClipRef);
      if (found && (protects(found.track) || protects(found.clip))) refuse(`${found.track.name} · ${found.clip.name}`);
    }
    for (const [child, item] of Object.entries(value)) inspect(item, child);
  };

  inspect(input);
  if (name === "lead_sheet_update") {
    if (Array.isArray(input.links)) for (const link of protectedLinks) {
      if (!input.links.some((replacement) => isObject(replacement) && replacement.tag === link.tag &&
        typeof replacement.role === "string" && key(replacement.role) === key(link.role))) refuse(link.role);
    }
    if (Array.isArray(input.sections)) for (const section of snapshot.sheet?.sections ?? []) if (locked.has(key(section.name))) {
      const replacement = input.sections.find((part) => isObject(part) && part.name === section.name);
      if (JSON.stringify(replacement) !== JSON.stringify(section)) refuse(section.name);
    }
  }
  if (name !== "lyrics_write" || typeof input.text !== "string") return;
  const current = snapshot.sheet?.lyrics ?? "";
  const effective = LyricsSections.unifyLinked(current, LyricsText.normalize(input.text));
  if (locked.has("lyrics") && current !== effective) refuse("Lyrics");
  const sections = (text: string) => {
    const parts = new Map<string, LyricsSection[]>();
    for (const section of LyricsSections.parse(text)) {
      if (section.name === null) continue;
      const label = key(section.name);
      parts.set(label, [...(parts.get(label) ?? []), section]);
    }
    return parts;
  };
  const before = sections(current), after = sections(effective);
  for (const [label, lines] of before) if (locked.has(label) && JSON.stringify(lines) !== JSON.stringify(after.get(label))) refuse(label);
}
