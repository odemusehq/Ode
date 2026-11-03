import { useEffect, useId, useState } from "react";
import type { LyricsState, WordCheck } from "../../shared/lyrics";
import { LyricsDocument } from "../../shared/lyrics-document";
import { LyricsSections } from "../../shared/lyrics-sections";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant, Icon, IconButton, IconName } from "../../ui-kit";
import { useClient } from "../app/hooks";
import { errorMessage } from "../app/api";
import { LyricNote } from "./LyricNote";
import type { WordSelection } from "./LyricsTextEditor";

/** Sentence emphasis is the normal edit; pronunciation and native notes are deliberate separate actions. */
export function SyllableChoice({ selected, state, onSaved, onDone }: { selected: WordSelection; state: LyricsState; onSaved: (state: LyricsState) => void; onDone: () => void }) {
  const client = useClient();
  const [panel, setPanel] = useState<"word" | "melody" | null>(null);
  const melodyId = useId();
  const editing = panel === "word";
  const [split, setSplit] = useState(selected.value.syllables.join(" "));
  const [stress, setStress] = useState<(number | null)[]>(selected.value.stress);
  const [wordStress, setWordStress] = useState<(number | null)[]>(selected.value.wordStress ?? selected.value.syllables.map(() => null));
  const [pronunciationChanged, setPronunciationChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pieces = split.trim() ? split.trim().split(/\s+/u) : [];
  const sameSplit = (syllables: string[]) => JSON.stringify(pieces) === JSON.stringify(syllables);
  const sungLine = state.text.split("\n").slice(0, selected.line).filter(LyricsSections.isSung).length - 1;
  const analysed = state.notation && LyricsDocument.check({ ...state.notation, choices: [] }, state.text)?.lines[sungLine]?.words[selected.word];
  const savedChoice = state.notation?.choices.find(choice => !choice.stale && choice.line === selected.line && choice.word === selected.word && choice.lineText === state.text.split("\n")[selected.line - 1]);
  const original = savedChoice?.default ?? analysed;
  const suggested = original?.text === selected.value.text && original.syllables.length > 0 && original.syllables.every(Boolean) && original.syllables.join("") === selected.value.text
    ? { ...original, wordStress: original.wordStress ?? (JSON.stringify(original.syllables) === JSON.stringify(analysed?.syllables) ? analysed?.wordStress : undefined) } : undefined;
  const differs = suggested && (!sameSplit(suggested.syllables) || JSON.stringify(stress) !== JSON.stringify(suggested.stress) || JSON.stringify(wordStress) !== JSON.stringify(suggested.wordStress ?? suggested.syllables.map(() => null)));
  const spells = pieces.length > 0 && pieces.join("") === selected.value.text;
  const lexicalValid = wordStress.every(value => value === null) || wordStress.every(value => value !== null);
  const valid = spells && stress.length === pieces.length && stress.every(value => value !== null) && lexicalValid;
  const reset = (word: WordCheck) => { setSplit(word.syllables.join(" ")); setStress(word.stress); setWordStress(word.wordStress ?? word.syllables.map(() => null)); };
  // Background annotations may refresh while this form is open. Keep the musician's unsaved edit.
  useEffect(() => { if (!editing) { reset(selected.value); setPronunciationChanged(false); } }, [selected.value, editing]);
  const changeSplit = (value: string) => {
    const next = value.trim() ? value.trim().split(/\s+/u) : [];
    const known = [selected.value, suggested].find(word => word && JSON.stringify(next) === JSON.stringify(word.syllables));
    if (JSON.stringify(next) !== JSON.stringify(pieces)) setPronunciationChanged(true);
    setSplit(value);
    setStress(values => next.map((piece, index) => (pieces[index] === piece ? values[index] : undefined) ?? known?.stress[index] ?? null));
    setWordStress(values => next.map((piece, index) => (pieces[index] === piece ? values[index] : undefined) ?? known?.wordStress?.[index] ?? null));
  };
  const cancel = () => { reset(selected.value); setError(""); setPanel(null); onDone(); };
  const lineBindings = state.notation?.clips.flatMap(clip => clip.bindings.filter(binding => binding.line === selected.line).map(binding => ({ ...binding, clipId: clip.id, actual: binding.notes.flatMap(index => clip.notes[index] ? [{ index, note: clip.notes[index]! }] : []) }))) ?? [];
  const lineText = state.text.split("\n")[selected.line - 1];
  const bindings = lineBindings.filter(binding => !binding.stale && binding.text === lineText && binding.word === selected.word);
  const alignmentPending = lineBindings.some(binding => binding.stale || binding.text !== lineText);
  const hasMelody = bindings.length > 0 || alignmentPending;
  const review = state.check?.lines[sungLine]?.review ?? [];
  const save = async () => {
    if (!valid) return;
    setBusy(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision) throw new Error(t("lyrics.document.annotationsChanged"));
      const answer = await client.api.chooseSyllables({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation?.revision ?? 0,
        line: selected.line, word: selected.word, pronunciation: pronunciationChanged || Boolean(savedChoice && savedChoice.pronunciation !== false), value: { text: selected.value.text, syllables: pieces, stress: stress.map(value => value!),
          ...(wordStress.every(value => value !== null) ? { wordStress: wordStress.map(value => value!) } : {}),
          ipa: sameSplit(selected.value.syllables) ? selected.value.ipa : suggested && sameSplit(suggested.syllables) ? suggested.ipa : undefined } });
      onSaved(answer); setPanel(null); onDone();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const stressControls = (lexical: boolean) => <fieldset className="lyrics-pronunciation__stress">
    <legend>{t(lexical ? "lyrics.document.wordStress" : "lyrics.document.sentenceEmphasis")}</legend>
    {pieces.map((piece, index) => <label key={index}>{pieces.length > 1 && <span>{piece}</span>}
      <select autoFocus={!lexical && index === 0} aria-label={t(lexical ? "lyrics.document.stressFor" : "lyrics.document.emphasisFor", { syllable: piece, index: index + 1 })} disabled={busy} value={(lexical ? wordStress : stress)[index] ?? ""} onChange={event => { if (lexical) setPronunciationChanged(true); (lexical ? setWordStress : setStress)(values => pieces.map((_, at) => at === index ? Number(event.target.value) : values[at] ?? null)); }}>
        <option value="" disabled>{t(lexical ? "lyrics.document.notAnalysed" : "lyrics.document.chooseEmphasis")}</option>
        <option value={0}>{t(lexical ? "lyrics.document.unstressed" : "lyrics.document.unemphasised")}</option>
        <option value={1}>{t(lexical ? "lyrics.document.primaryStress" : "lyrics.document.emphasised")}</option>
        <option value={2}>{t(lexical ? "lyrics.document.secondaryStress" : "lyrics.document.secondaryEmphasis")}</option>
      </select>
    </label>)}
  </fieldset>;
  return <div className="lyrics-pronunciation">
    {!editing && <div className="lyrics-pronunciation__head">
      <strong>{selected.value.syllables.join(" ")}</strong>
      <button type="button" className="lyrics-pronunciation__edit" aria-label={t("lyrics.document.editPronunciation")} title={t("lyrics.document.editPronunciation")} onClick={() => { setError(""); setPanel("word"); }}><Icon name={IconName.Edit} /></button>
      {hasMelody && <IconButton className="lyrics-pronunciation__melody" icon={IconName.Music} label={t("lyrics.document.editMelody")} aria-expanded={panel === "melody"} aria-controls={melodyId} onClick={() => setPanel(panel === "melody" ? null : "melody")} />}
    </div>}
    {editing && <form className="lyrics-pronunciation__form" onSubmit={event => { event.preventDefault(); if (valid && !busy) void save(); }} onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
      {stressControls(false)}
      <details className="lyrics-pronunciation__override">
        <summary>{t("lyrics.document.pronunciation")}</summary>
        <label>{t("lyrics.document.syllableSplit")}<input aria-label={t("lyrics.document.syllableSplit")} title={t("lyrics.document.syllableSplitHint")} value={split} disabled={busy} onChange={event => changeSplit(event.target.value)} /></label>
        {stressControls(true)}
      </details>
      {!spells && <span role="alert">{t("lyrics.document.retainSpelling")}</span>}
      <div className="lyrics-pronunciation__actions">
        <Button type="submit" disabled={!valid || busy}>{t("common.save")}</Button>
        <Button variant={ButtonVariant.Quiet} disabled={busy} onClick={cancel}>{t("common.cancel")}</Button>
        <Button variant={ButtonVariant.Quiet} title={t("lyrics.document.defaultHint")} disabled={busy || !differs} onClick={() => { if (suggested) { setPronunciationChanged(JSON.stringify(suggested.syllables) !== JSON.stringify(selected.value.syllables) || JSON.stringify(suggested.wordStress) !== JSON.stringify(selected.value.wordStress)); reset(suggested); } }}>{t("lyrics.document.default")}</Button>
      </div>
    </form>}
    {!editing && hasMelody && <div id={melodyId} hidden={panel !== "melody"} className="lyrics-pronunciation__music" aria-label={t("lyrics.document.savedMelody")}>{panel === "melody" && alignmentPending && <span>{t("lyrics.document.alignmentStale")}</span>}{panel === "melody" && bindings.map((binding, index) => <span key={index}>
      {selected.value.syllables[binding.syllable] ?? ""} · {binding.actual.map(({ index: noteIndex, note }, at) => <LyricNote key={at} state={state} clipId={binding.clipId} noteIndex={noteIndex} note={note} syllable={selected.value.syllables[binding.syllable] ?? selected.value.text} />)}
    </span>)}</div>}
    {review.length > 0 && <details className="lyrics-pronunciation__review"><summary>{t("lyrics.document.phraseReview")}</summary><ul>{review.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
