import { LyricsDocument } from "../../shared/lyrics-document";
import { t } from "../../shared/i18n";
import { z } from "zod";
import { LyricsText } from "../../mneme/lyrics-text";
import { SetWording } from "../../mneme/set-diff";

import type { LyricsState } from "../../shared/lyrics";
import { VersionAuthor } from "../../shared/versions";
import { defineTool, type AnyTool } from "../define";

interface LyricsEdit { text: string; baseRevision: number; startLine?: number; endLine?: number }

/** A literal text splice, with no lyric interpretation. Expand before lock checks and revision-aware persistence. */
export function resolveLyricsEdit(edit: LyricsEdit, current: Pick<LyricsState, "text" | "revision">): LyricsEdit {
  if (edit.startLine === undefined) {
    if (edit.endLine !== undefined) throw new Error(t("lyricText.rangeRequired"));
    return edit;
  }
  if (current.revision !== edit.baseRevision) throw new Error(t("lyricText.staleRange"));
  const lines = LyricsText.lines(current.text);
  const end = edit.endLine ?? edit.startLine;
  if (edit.startLine > lines.length + 1 || end > lines.length || end < edit.startLine - 1) throw new Error(t("lyricText.invalidRange"));
  const replacement = edit.text === "" ? [] : LyricsText.lines(edit.text);
  return { text: [...lines.slice(0, edit.startLine - 1), ...replacement, ...lines.slice(end)].join("\n"), baseRevision: edit.baseRevision };
}

export const lyricTextTools: AnyTool[] = [
  defineTool({
    name: "lyrics_read",
    changes: "none",
    alwaysLoad: true,
    description:
      'Read all lyrics or inclusive startLine/endLine, numbered from 1 including headings/blanks. Returns songId, text revision, notationRevision, numbered lines, shared structured word/syllable/stress/IPA/rhyme annotations, and bound melody notes for the portion. Word and syllable indices are zero-based; line numbers are absolute and one-based. Bound MIDI is refreshed through the SDK; melodyVerified=false means it could not be verified, and stale bindings require explicit reconciliation. needsAnalysis signals missing/stale linguistic interpretation: call lyricist with analyse:true, not a local rule engine. Each bound note includes a score position: the actual MusicXML measure number, beat in the denominator unit and time signature; absent score position means unknown metre, never assumed 4/4. Longer notes alone do not create new syllables. Read before lyrics_write or lyrics_choose_syllables.',
    input: { startLine: z.number().int().positive().optional(), endLine: z.number().int().positive().optional() },
    run: async ({ startLine = 1, endLine }, ctx) => {
      let lyrics = await ctx.lyrics.read();
      let melodyVerified = !lyrics.notation?.clips.length;
      if (lyrics.notation?.clips.length && typeof ctx.live.extension.call === "function") {
        const refreshed = await ctx.lyrics.refreshMelody(async clip => {
          const result = await ctx.live.extension.call<{ notes: import("../../shared/live").Note[] }>("midi_clip_get_notes", { clip }, ctx.signal);
          return result.notes;
        }, ctx.signal);
        lyrics = refreshed.lyrics;
        melodyVerified = refreshed.verified;
      }
      const lines = LyricsText.numbered(lyrics.text);
      if (endLine !== undefined && endLine < startLine) throw new Error(t("lyricText.reverseRange"));
      let sung = 0;
      const annotations = LyricsText.lines(lyrics.text).flatMap((text, at) => {
        if (!LyricsText.isSung(text)) return [];
        const check = lyrics.check?.lines[sung++];
        return check && at + 1 >= startLine && (endLine === undefined || at < endLine) ? [{ line: at + 1, text, ...check }] : [];
      });
      const notation = lyrics.notation;
      const melody = notation?.clips.flatMap(clip => clip.bindings.filter(binding => binding.line >= startLine && (endLine === undefined || binding.line <= endLine))
        .map(binding => ({ ...binding, clip: clip.clip, notes: binding.notes.map(index => ({ index, ...clip.notes[index], score: clip.notes[index] ? LyricsDocument.position(clip, clip.notes[index]!.start) : undefined })) }))) ?? [];
      return { songId: lyrics.songId, revision: lyrics.revision, notationRevision: notation?.revision ?? 0, totalLines: lines.length, lines: lines.slice(startLine - 1, endLine),
        annotations, melody, melodyVerified, needsAnalysis: LyricsDocument.needsAnalysis(notation, lyrics.text) };
    },
  }),
  defineTool({
    name: "lyrics_write",
    changes: "memory",
    description:
      'Replace inclusive startLine/endLine with text from Lyricist, against baseRevision from lyrics_read. Only that portion changes; an empty replacement deletes those lines. For insertion use endLine=startLine-1. Omit both bounds only for an intended whole-text replacement or an empty new song. Never include printed line numbers. A changed revision refuses a portion edit so shifted lines cannot be overwritten. Linked copies remain linked and locks are preserved. Whole-text saves retain the existing merge behaviour: concurrent musician edits win conflicts, returned as line numbers. This tool performs literal text persistence, no lyric analysis.',
    input: {
      text: z.string().describe("Literal replacement text, without printed line numbers"),
      baseRevision: z.number().int().min(0).describe("The revision lyrics_read gave for the text you edited"),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().min(0).optional(),
    },
    describe: ({ text, baseRevision, startLine, endLine }, names) => names.lyrics(text, baseRevision, startLine, endLine),
    run: async (input, ctx) => {
      const { text, baseRevision } = input.startLine === undefined ? resolveLyricsEdit(input, { text: "", revision: input.baseRevision })
        : resolveLyricsEdit(input, await ctx.lyrics.read());
      const saved = await ctx.lyrics.write(text, baseRevision, VersionAuthor.Ode);
      const result: { revision: number; conflicts: number[]; note?: string; lines?: string[] } = {
        revision: saved.revision,
        conflicts: saved.conflicts,
      };
      if (saved.conflicts.length > 0) {
        const where = `${saved.conflicts.length === 1 ? "line" : "lines"} ${SetWording.spans(saved.conflicts)}`;
        result.note = `The musician changed the same lines at the same time, so their lines were kept: ${where}.`;
      }
      if (saved.text !== LyricsText.normalize(text)) result.lines = LyricsText.numbered(saved.text);
      return { ...result, __odeReceipts: saved.receipt ? [saved.receipt] : [] };
    },
  })
];
