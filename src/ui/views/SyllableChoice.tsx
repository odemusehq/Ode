import { useState } from "react";
import type { LyricsState } from "../../shared/lyrics";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant, Icon, IconName } from "../../ui-kit";
import { useClient } from "../app/hooks";
import { errorMessage } from "../app/api";
import { LyricNote } from "./LyricNote";
import type { WordSelection } from "./LyricsTextEditor";

/** A deliberate pronunciation choice, separate from the literal lyrics and native MIDI edits. */
export function SyllableChoice({ selected, state, onSaved }: { selected: WordSelection; state: LyricsState; onSaved: (state: LyricsState) => void }) {
  const client = useClient();
  const [editing, setEditing] = useState(false);
  const [split, setSplit] = useState(selected.value.syllables.join("·"));
  const [stress, setStress] = useState(selected.value.stress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pieces = split.split("·").map(piece => piece.trim());
  const valid = pieces.every(Boolean) && pieces.join("") === selected.value.text;
  const bindings = state.notation?.clips.flatMap(clip => clip.bindings.filter(binding => binding.line === selected.line && binding.word === selected.word).map(binding => ({ ...binding, clipId: clip.id, actual: binding.notes.flatMap(index => clip.notes[index] ? [{ index, note: clip.notes[index]! }] : []) }))) ?? [];
  const save = async () => {
    setBusy(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision) throw new Error(t("lyrics.document.annotationsChanged"));
      const answer = await client.api.chooseSyllables({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation?.revision ?? 0,
        line: selected.line, word: selected.word, value: { text: selected.value.text, syllables: pieces, stress: pieces.map((_, index) => stress[index] ?? 0),
          ...(JSON.stringify(pieces) === JSON.stringify(selected.value.syllables) ? { ipa: selected.value.ipa } : {}) } });
      onSaved(answer); setEditing(false);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="lyrics-pronunciation">
    <div className="lyrics-pronunciation__head">
      <strong>{selected.value.text}</strong>
      <span className="lyrics-pronunciation__split">{selected.value.syllables.join("·")}</span>
      <button type="button" className="lyrics-pronunciation__edit" aria-label={t("lyrics.document.editPronunciation")} title={t("lyrics.document.editPronunciation")} onClick={() => setEditing(!editing)}><Icon name={IconName.Edit} /></button>
    </div>
    {editing && <form className="lyrics-pronunciation__form" onSubmit={event => { event.preventDefault(); if (valid && !busy) void save(); }}>
      <label>{t("lyrics.document.syllableSplit")}<input aria-label={t("lyrics.document.syllableSplit")} value={split} disabled={busy} onChange={event => { setSplit(event.target.value); setStress([]); }} /></label>
      <div className="lyrics-pronunciation__stress">{pieces.map((piece, index) => <label key={index}>{piece}<select aria-label={t("lyrics.document.stressFor", { syllable: piece })} disabled={busy} value={stress[index] ?? 0} onChange={event => setStress(values => pieces.map((_, at) => at === index ? Number(event.target.value) : values[at] ?? 0))}>
        <option value={0}>{t("lyrics.document.unstressed")}</option><option value={1}>{t("lyrics.document.primaryStress")}</option><option value={2}>{t("lyrics.document.secondaryStress")}</option>
      </select></label>)}</div>
      {!valid && <span role="alert">{t("lyrics.document.retainSpelling")}</span>}
      <div className="lyrics-pronunciation__actions"><Button type="submit" disabled={!valid || busy}>{t("common.save")}</Button><Button variant={ButtonVariant.Quiet} disabled={busy} onClick={() => setEditing(false)}>{t("common.cancel")}</Button></div>
    </form>}
    {bindings.length > 0 && <div className="lyrics-pronunciation__music" aria-label={t("lyrics.document.savedMelody")} title={t("lyrics.document.savedMelody")}>{bindings.map((binding, index) => <span key={index}>
      {selected.value.syllables[binding.syllable] ?? ""} · {binding.stale ? t("lyrics.document.alignmentStale") : binding.actual.map(({ index: noteIndex, note }, at) => <LyricNote key={at} state={state} clipId={binding.clipId} noteIndex={noteIndex} note={note} syllable={selected.value.syllables[binding.syllable] ?? selected.value.text} />)}
    </span>)}</div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
