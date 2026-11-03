import { useId, useState } from "react";
import type { LyricsState } from "../../shared/lyrics";
import { LyricsDocument } from "../../shared/lyrics-document";
import { LyricsSections } from "../../shared/lyrics-sections";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant, Icon, IconName } from "../../ui-kit";
import { useClient } from "../app/hooks";
import { errorMessage } from "../app/api";
import { LyricNote } from "./LyricNote";
import type { WordSelection } from "./LyricsTextEditor";

/** A deliberate pronunciation choice, separate from the literal lyrics and native MIDI edits. */
export function SyllableChoice({ selected, state, onSaved, onDone }: { selected: WordSelection; state: LyricsState; onSaved: (state: LyricsState) => void; onDone: () => void }) {
  const client = useClient();
  const [panel, setPanel] = useState<"pronunciation" | "melody" | null>(null);
  const melodyId = useId();
  const editing = panel === "pronunciation";
  const [split, setSplit] = useState(selected.value.syllables.join(" "));
  const [stress, setStress] = useState<(number | null)[]>(selected.value.stress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pieces = split.trim() ? split.trim().split(/\s+/u) : [];
  const sameSplit = (syllables: string[]) => JSON.stringify(pieces) === JSON.stringify(syllables);
  const sungLine = state.text.split("\n").slice(0, selected.line).filter(LyricsSections.isSung).length - 1;
  // Read the saved model suggestion without applying the musician's override.
  const analysed = state.notation && LyricsDocument.check({ ...state.notation, choices: [] }, state.text)?.lines[sungLine]?.words[selected.word];
  const suggested = analysed?.text === selected.value.text && analysed.syllables.length > 0 && analysed.syllables.every(Boolean) && analysed.syllables.join("") === selected.value.text ? analysed : undefined;
  const differs = suggested && (!sameSplit(suggested.syllables) || JSON.stringify(stress) !== JSON.stringify(suggested.stress));
  const spells = pieces.length > 0 && pieces.join("") === selected.value.text;
  const valid = spells && stress.length === pieces.length && stress.every(value => value !== null);
  const changeSplit = (value: string) => {
    const next = value.trim() ? value.trim().split(/\s+/u) : [];
    const known = [selected.value, suggested].find(word => word && JSON.stringify(next) === JSON.stringify(word.syllables));
    setSplit(value);
    setStress(values => next.map((piece, index) => (pieces[index] === piece ? values[index] : undefined) ?? known?.stress[index] ?? null));
  };
  const cancel = () => { setSplit(selected.value.syllables.join(" ")); setStress(selected.value.stress); setError(""); setPanel(null); onDone(); };
  const bindings = state.notation?.clips.flatMap(clip => clip.bindings.filter(binding => binding.line === selected.line && binding.word === selected.word).map(binding => ({ ...binding, clipId: clip.id, actual: binding.notes.flatMap(index => clip.notes[index] ? [{ index, note: clip.notes[index]! }] : []) }))) ?? [];
  const save = async () => {
    if (!valid) return;
    setBusy(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision) throw new Error(t("lyrics.document.annotationsChanged"));
      const answer = await client.api.chooseSyllables({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation?.revision ?? 0,
        line: selected.line, word: selected.word, value: { text: selected.value.text, syllables: pieces, stress: stress.map(value => value!),
          ipa: sameSplit(selected.value.syllables) ? selected.value.ipa : suggested && sameSplit(suggested.syllables) ? suggested.ipa : undefined } });
      onSaved(answer); setPanel(null); onDone();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="lyrics-pronunciation">
    {!editing && <div className="lyrics-pronunciation__head">
      <strong>{selected.value.syllables.join(" ")}</strong>
      <button type="button" className="lyrics-pronunciation__edit" aria-label={t("lyrics.document.editPronunciation")} title={t("lyrics.document.editPronunciation")} onClick={() => { setError(""); setPanel("pronunciation"); }}><Icon name={IconName.Edit} /></button>
      {bindings.length > 0 && <Button className="lyrics-pronunciation__melody" variant={ButtonVariant.Quiet} icon={IconName.Music} aria-expanded={panel === "melody"} aria-controls={melodyId} onClick={() => setPanel(panel === "melody" ? null : "melody")}>{t("lyrics.document.melody")}</Button>}
    </div>}
    {editing && <form className="lyrics-pronunciation__form" onSubmit={event => { event.preventDefault(); if (valid && !busy) void save(); }} onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
      <label>{t("lyrics.document.syllableSplit")}<input aria-label={t("lyrics.document.syllableSplit")} title={t("lyrics.document.syllableSplitHint")} autoFocus value={split} disabled={busy} onChange={event => changeSplit(event.target.value)} /></label>
      <fieldset className="lyrics-pronunciation__stress"><legend>{t("lyrics.document.wordStress")}</legend>{pieces.map((piece, index) => <label key={index}>{pieces.length > 1 && <span>{piece}</span>}<select aria-label={t("lyrics.document.stressFor", { syllable: piece, index: index + 1 })} disabled={busy} value={stress[index] ?? ""} onChange={event => setStress(values => pieces.map((_, at) => at === index ? Number(event.target.value) : values[at] ?? null))}>
        <option value="" disabled>{t("lyrics.document.chooseStress")}</option>
        <option value={0}>{t("lyrics.document.unstressed")}</option><option value={1}>{t("lyrics.document.primaryStress")}</option><option value={2}>{t("lyrics.document.secondaryStress")}</option>
      </select></label>)}</fieldset>
      {!spells && <span role="alert">{t("lyrics.document.retainSpelling")}</span>}
      <div className="lyrics-pronunciation__actions">
        <Button type="submit" disabled={!valid || busy}>{t("common.save")}</Button>
        <Button variant={ButtonVariant.Quiet} disabled={busy} onClick={cancel}>{t("common.cancel")}</Button>
        <Button variant={ButtonVariant.Quiet} title={t("lyrics.document.defaultHint")} disabled={busy || !differs} onClick={() => { if (suggested) { setSplit(suggested.syllables.join(" ")); setStress(suggested.stress); } }}>{t("lyrics.document.default")}</Button>
      </div>
    </form>}
    {!editing && bindings.length > 0 && <div id={melodyId} hidden={panel !== "melody"} className="lyrics-pronunciation__music" aria-label={t("lyrics.document.savedMelody")}>{panel === "melody" && bindings.map((binding, index) => <span key={index}>
      {selected.value.syllables[binding.syllable] ?? ""} · {binding.stale ? t("lyrics.document.alignmentStale") : binding.actual.map(({ index: noteIndex, note }, at) => <LyricNote key={at} state={state} clipId={binding.clipId} noteIndex={noteIndex} note={note} syllable={selected.value.syllables[binding.syllable] ?? selected.value.text} />)}
    </span>)}</div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
