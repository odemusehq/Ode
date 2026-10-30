import type { Note } from "../../shared/live";
import { ChangeKind, type SetChange } from "../../shared/versions";
import { t } from "../../shared/i18n";
import { NOTE_NAMES } from "../../shared/notes";
import { LineDiff } from "../app/line-diff";
import type { LineHunk } from "../app/line-diff";

/** Between the part a change is in and what changed: "Bass · notes in bars 9–16". */
const LABEL_SEPARATOR = " · ";
const PREVIEW_LINES = 6;
const WARP_MODES = ["beats", "tones", "texture", "repitch", "complex", "rex", "complexPro"] as const;

/** Present a device replaced in the same slot as one comparison, keeping its stored deltas intact. */
export function previewChanges(changes: readonly SetChange[]): SetChange[] {
  const paired = new Set<SetChange>();
  return changes.flatMap((change) => {
    if (paired.has(change)) return [];
    if (change.kind !== ChangeKind.Removed || change.target.scope !== "device" || change.target.field !== "present") return [change];
    const added = changes.find((next) => next.kind === ChangeKind.Added && !paired.has(next) &&
      JSON.stringify(next.target) === JSON.stringify(change.target));
    if (!added || !isRecord(change.before) || !isRecord(added.after)) return [change];
    paired.add(added);
    return [{ ...change, kind: ChangeKind.Changed, after: added.after,
      label: `${change.target.track.name}${LABEL_SEPARATOR}${t("history.preview.deviceReplacement", { before: namedValue(change.before), after: namedValue(added.after) })}` }];
  });
}

/** Small, readable summaries of stored values; restore still uses the original data. */
export function changeValues(change: SetChange): { before: string[]; after: string[]; rawParameter: boolean } | null {
  if (isLyricsChange(change) || notesChange(change) || change.target.scope === "sheet" && change.target.field === "details") return null;
  const preview = (value: unknown): string[] => {
    const { target } = change;
    if (value === undefined) return [t("history.preview.notPresent")];
    if (target.scope === "track" && target.field === "position" && typeof value === "number") {
      return [t("history.preview.position", { position: value + 1 })];
    }
    if (target.scope === "track" && target.field === "takeLanes" && Array.isArray(value)) {
      return compact(value.filter(isRecord).map((lane, index) => t("history.preview.takeLane", { position: index + 1, name: lane.name || t("history.preview.unnamed") })));
    }
    if (typeof value === "boolean") return [t(value ? "history.preview.on" : "history.preview.off")];
    if (typeof value === "number") return [numberText(value)];
    if (typeof value === "string") return [value || t("history.preview.empty")];
    if (value === null) return [t("history.preview.unavailable")];
    if (Array.isArray(value)) return compact(value.map((item) => {
      if (!isRecord(item)) return String(item);
      const name = namedValue(item);
      if (typeof item.time === "number") return t("history.preview.locator", { name, beat: item.time });
      return typeof item.tempo === "number" ? t("history.preview.scene", { name, tempo: item.tempo, numerator: item.signatureNumerator, denominator: item.signatureDenominator }) : name;
    }));
    if (!isRecord(value)) return [];
    if (target.scope === "device" && target.field === "present") {
      const lines = [namedValue(value)];
      if (typeof value.sample === "string") lines.push(fileName(value.sample));
      if (Array.isArray(value.parameters)) lines.push(t("history.preview.controls", { count: value.parameters.length }));
      // When a device exposes different controls, show the actual differing names/ranges, not just the count.
      const other = value === change.before ? change.after : change.before;
      if (isRecord(other) && Array.isArray(value.parameters) && Array.isArray(other.parameters)) {
        const controls = other.parameters;
        value.parameters.forEach((parameter, index) => {
          if (!isRecord(parameter)) return;
          const next = controls[index];
          if (isRecord(next) && parameter.name === next.name && parameter.min === next.min && parameter.max === next.max &&
            parameter.isQuantized === next.isQuantized && JSON.stringify(parameter.valueItems) === JSON.stringify(next.valueItems)) return;
          lines.push(t("history.preview.controlRange", { name: parameter.name, min: parameter.min, max: parameter.max }));
          if (parameter.isQuantized && Array.isArray(parameter.valueItems) && parameter.valueItems.length) lines.push(compact(parameter.valueItems.map(String)).join(" · "));
        });
      }
      if (Array.isArray(value.chains)) lines.push(...value.chains.filter(isRecord).map((chain, index) =>
        t("history.preview.chain", { position: index + 1, devices: Array.isArray(chain.devices) ? chain.devices.filter(isRecord).map(namedValue).join(" · ") : "" })));
      return compact(lines);
    }
    if (target.scope === "track" && target.field === "present") {
      const devices = Array.isArray(value.devices) ? value.devices.filter(isRecord).map(namedValue) : [];
      const clips = (Array.isArray(value.arrangementClips) ? value.arrangementClips.length : 0) +
        (Array.isArray(value.clipSlots) ? value.clipSlots.filter((slot) => isRecord(slot) && slot.clip).length : 0) +
        (Array.isArray(value.takeLanes) ? value.takeLanes.reduce((count, lane) => count + (isRecord(lane) && Array.isArray(lane.clips) ? lane.clips.length : 0), 0) : 0);
      return compact([namedValue(value), ...devices, t("history.preview.clips", { count: clips })]);
    }
    if (target.scope === "song" && target.field === "key") {
      return [`${NOTE_NAMES[Number(value.rootNote)] ?? ""} ${value.scaleName ?? ""}`.trim()];
    }
    if (target.scope === "song" && target.field === "signature") return [`${value.numerator}/${value.denominator}`];
    if (target.scope === "clip" && target.field === "loop") {
      return [t(value.looping ? "history.preview.loopOn" : "history.preview.loopOff"),
        t("history.preview.beatRange", { start: value.loopStart, end: value.loopEnd }),
        t("history.preview.markers", { start: value.startMarker, end: value.endMarker }),
        t("history.preview.duration", { beats: value.duration })];
    }
    if (target.scope === "clip" && (target.field === "audio" || target.field === "present")) {
      const warpMode = WARP_MODES[Number(value.warpMode)];
      return [typeof value.name === "string" ? value.name : t("history.preview.audio"),
        ...(typeof value.filePath === "string" ? [fileName(value.filePath)] : []),
        ...(typeof value.warping === "boolean" ? [t(value.warping ? "history.preview.warpOn" : "history.preview.warpOff")] : []),
        ...(typeof value.warpMode === "number" ? [t("history.preview.warpMode", { mode: warpMode ? t(`history.preview.warpModes.${warpMode}`) : value.warpMode })] : []),
        ...(Array.isArray(value.warpMarkers) ? [t("history.preview.warpMarkers", { count: value.warpMarkers.length })] : [])];
    }
    if (target.scope === "sheet" && target.field === "section") {
      const chords = Array.isArray(value.chords) ? value.chords.filter(isRecord).map((chord) => String(chord.symbol)).join(" · ") : "";
      return [namedValue(value), t("history.preview.beatRange", { start: value.startBeat, end: Number(value.startBeat) + Number(value.lengthBeats) }), ...(chords ? [chords] : [])];
    }
    return [namedValue(value)];
  };
  return { before: preview(change.before), after: preview(change.after),
    rawParameter: change.target.scope === "device" && change.target.field === "parameter" };
}

function compact(lines: string[]): string[] {
  if (lines.length === 0) return [t("history.preview.empty")];
  return lines.length > PREVIEW_LINES ? [...lines.slice(0, PREVIEW_LINES), t("history.preview.more", { count: lines.length - PREVIEW_LINES })] : lines;
}

function numberText(value: number): string {
  return Number.isFinite(value) ? String(value) : t("history.preview.unavailable");
}

function namedValue(value: Record<string, unknown>): string {
  return typeof value.name === "string" && value.name ? value.name :
    typeof value.title === "string" && value.title ? value.title : t("history.preview.unnamed");
}

function fileName(value: string): string {
  return value.split(/[\\/]/).at(-1) || value;
}

/** A clip's notes before and after; one side is missing for a clip that was added or removed. */
export interface NotesChange {
  before?: Note[];
  after?: Note[];
}

/** The notes before and after, for a change to a MIDI clip's notes or a MIDI clip added or removed; otherwise null. */
export function notesChange(change: SetChange): NotesChange | null {
  const { target, before, after } = change;
  if (target.scope !== "clip" || (target.field !== "notes" && target.field !== "present")) return null;
  const notesBefore = notesOf(before, target.field);
  const notesAfter = notesOf(after, target.field);
  return notesBefore || notesAfter ? { before: notesBefore, after: notesAfter } : null;
}

export function isLyricsChange(change: SetChange): boolean {
  return change.target.scope === "sheet" && change.target.field === "lyrics";
}

/** The lines of the lyrics that changed, each place with its old lines and the new ones; blank lines left out. */
export function lyricsHunks(change: SetChange): LineHunk[] {
  const diff = new LineDiff(LineDiff.lines(textOf(change.before)), LineDiff.lines(textOf(change.after)));
  return diff
    .hunks()
    .map((hunk) => ({ removed: hunk.removed.filter(isWritten), added: hunk.added.filter(isWritten) }))
    .filter((hunk) => hunk.removed.length > 0 || hunk.added.length > 0);
}

/** The last beat any of the notes sounds, from the clip start. */
export function notesEnd(notes: readonly Note[]): number {
  return notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
}

/** A label without the name of the part it is shown under: "Bass · notes in bars 9–16" under Bass. */
export function labelUnder(label: string, heading: string): string {
  const prefix = `${heading}${LABEL_SEPARATOR}`;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

/** A line with words on it, sung or a label such as "[Chorus]"; blank lines between stanzas are left out. */
function isWritten(line: string): boolean {
  return line.trim() !== "";
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A clip's notes when its notes changed, or the notes of a whole MIDI clip that was added or removed. */
function notesOf(value: unknown, field: "notes" | "present"): Note[] | undefined {
  if (field === "notes") return isNoteList(value) ? value : undefined;
  if (isRecord(value) && isNoteList(value.notes)) return value.notes;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoteList(value: unknown): value is Note[] {
  return Array.isArray(value) && value.every(isNote);
}

function isNote(value: unknown): value is Note {
  return isRecord(value) && typeof value.pitch === "number" && typeof value.start === "number" && typeof value.duration === "number";
}
