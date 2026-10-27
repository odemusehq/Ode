import type { ClipRef, LivePointer } from "../../shared/live";

export interface PointedClip {
  clip: ClipRef;
  /** The musician pointed at an audio clip, which has no notes. */
  audio: boolean;
  description: string;
}

/** The clip a right-click "Ask Ode" pointed at, if it was a clip. */
export function pointedClip(pointer: LivePointer | null): PointedClip | null {
  if (!pointer) return null;
  const { target } = pointer;
  const clip = isClipRef(target) ? target : hasClip(target) ? target.clip : null;
  if (!clip) return null;
  return { clip, audio: /audio/i.test(pointer.scope), description: pointer.description };
}

export function isClipRef(value: unknown): value is ClipRef {
  if (typeof value !== "object" || value === null) return false;
  if ("tag" in value && typeof value.tag === "string") return true;
  if (!("track" in value) || typeof value.track !== "object" || value.track === null) return false;
  return ("slot" in value && typeof value.slot === "number") || ("start" in value && typeof value.start === "number");
}

function hasClip(value: unknown): value is { clip: ClipRef } {
  return typeof value === "object" && value !== null && "clip" in value && isClipRef(value.clip);
}
