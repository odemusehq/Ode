import { useState } from "react";
import { t } from "../../shared/i18n";
import type { Note } from "../../shared/live";
import type { LyricsState } from "../../shared/lyrics";
import { LyricsDocument, type LyricsMelodyEdit } from "../../shared/lyrics-document";
import { Select, formatBeatFraction } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import { errorMessage } from "../app/api";

const PITCHES = Array.from({ length: 128 }, (_, pitch) => ({ value: String(pitch), label: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pitch % 12] + String(Math.floor(pitch / 12) - 1) }));
const VALUES = [
  { duration: 4, name: "wholeNote", glyph: "𝅝" }, { duration: 3, name: "dottedHalfNote", glyph: "𝅗𝅥·" }, { duration: 2, name: "halfNote", glyph: "𝅗𝅥" },
  { duration: 1.5, name: "dottedQuarterNote", glyph: "♩·" }, { duration: 1, name: "quarterNote", glyph: "♩" }, { duration: 0.75, name: "dottedEighthNote", glyph: "♪·" },
  { duration: 0.5, name: "eighthNote", glyph: "♪" }, { duration: 0.25, name: "sixteenthNote", glyph: "𝅘𝅥𝅯" }, { duration: 0.125, name: "thirtySecondNote", glyph: "𝅘𝅥𝅰" },
  { duration: 2 / 3, name: "quarterTriplet", glyph: "♩₃" }, { duration: 1 / 3, name: "eighthTriplet", glyph: "♪₃" },
] as const;

/** Direct note editing uses the shared document revision and native MIDI guard, without a model request. */
export function LyricNote({ state, clipId, noteIndex, note, syllable }: { state: LyricsState; clipId: string; noteIndex: number; note: Note; syllable: string }) {
  const client = useClient();
  const working = useAppState(state => state.busy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const clip = state.notation!.clips.find(clip => clip.id === clipId)!;
  const position = LyricsDocument.position(clip, note.start);
  const unit = (position?.meter.beatType ?? 4) / 4;
  const label = (duration: number) => t("lyrics.document.noteValueCurrent", { duration: formatBeatFraction(duration * unit), single: duration * unit <= 1 });
  const values = VALUES.map(value => ({ value: String(value.duration), label: `${value.glyph} ${formatBeatFraction(value.duration * unit)}`, ariaLabel: `${t(`lyrics.document.${value.name}`)} · ${label(value.duration)}` }));
  if (!VALUES.some(value => value.duration === note.duration)) values.unshift({ value: String(note.duration), label: formatBeatFraction(note.duration * unit), ariaLabel: label(note.duration) });

  const edit = async (patch: Pick<LyricsMelodyEdit, "pitch" | "duration">) => {
    setSaving(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision) throw new Error(t("lyrics.document.annotationsChanged"));
      const result = await client.api.editLyricMelody({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation!.revision, clipId, note: noteIndex, ...patch });
      client.lyrics.receive(result.lyrics);
      setError(result.warning ?? "");
    } catch (error) {
      await client.lyrics.load();
      setError(errorMessage(error));
    } finally { setSaving(false); }
  };
  return <span className="lyric-note" aria-busy={saving}>
    <Select aria-label={t("lyrics.document.pitchForSyllable", { syllable })} value={String(note.pitch)} options={PITCHES} disabled={working || saving} onChange={pitch => void edit({ pitch: Number(pitch) })} />
    <Select aria-label={t("lyrics.document.rhythmForSyllable", { syllable })} value={String(note.duration)} options={values} disabled={working || saving} onChange={duration => void edit({ duration: Number(duration) })} />
    {position && <span className="lyric-note__position">{t("lyrics.document.scorePosition", { measure: position.measure, beat: formatBeatFraction(position.beat) })} ({t("lyrics.document.scoreMeter", position.meter)})</span>}
    {error && <span className="lyric-note__error" role="alert">{error}</span>}
  </span>;
}
