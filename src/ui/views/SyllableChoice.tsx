import { useEffect, useState } from "react";
import type { LyricsState, WordCheck } from "../../shared/lyrics";
import { LyricsDocument } from "../../shared/lyrics-document";
import { LyricsSections } from "../../shared/lyrics-sections";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant } from "../../ui-kit";
import { useClient } from "../app/hooks";
import { errorMessage } from "../app/api";
import type { WordSelection } from "./LyricsTextEditor";

/** Word pronunciation only. Phrase emphasis and MIDI are edited in their own contexts. */
export function SyllableChoice({ selected, state, onSaved, onDone }: { selected: WordSelection; state: LyricsState; onSaved: (state: LyricsState) => void; onDone: () => void }) {
  const client = useClient();
  const [split, setSplit] = useState(selected.value.syllables.join(" "));
  const [stress, setStress] = useState<(number | null)[]>(selected.value.wordStress ?? selected.value.syllables.map(() => null));
  const [dirty, setDirty] = useState(false);
  const [divisionEdited, setDivisionEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pieces = split.trim() ? split.trim().split(/\s+/u) : [];
  const sameSplit = (syllables: string[]) => JSON.stringify(pieces) === JSON.stringify(syllables);
  const sungLine = state.text.split("\n").slice(0, selected.line).filter(LyricsSections.isSung).length - 1;
  const automatic = state.notation && LyricsDocument.check({ ...state.notation, choices: [] }, state.text)?.lines[sungLine]?.words[selected.word];
  const saved = state.notation?.choices.find(choice => !choice.stale && choice.line === selected.line && choice.word === selected.word && choice.lineText === state.text.split("\n")[selected.line - 1]);
  const baseline = saved?.default ?? automatic;
  const suggested = baseline?.text === selected.value.text && baseline.syllables.join("") === selected.value.text
    ? { ...baseline, wordStress: baseline.wordStress ?? (JSON.stringify(baseline.syllables) === JSON.stringify(automatic?.syllables) ? automatic?.wordStress : undefined) } : undefined;
  const differs = suggested && (!sameSplit(suggested.syllables) || JSON.stringify(stress) !== JSON.stringify(suggested.wordStress ?? suggested.syllables.map(() => null)));
  const spells = pieces.length > 0 && pieces.join("") === selected.value.text;
  const valid = spells && (stress.every(value => value === null) || stress.every(value => value !== null));
  const reset = (word: WordCheck) => { setSplit(word.syllables.join(" ")); setStress(word.wordStress ?? word.syllables.map(() => null)); };
  useEffect(() => { if (!dirty) reset(selected.value); }, [selected.value, dirty]);
  const changeSplit = (value: string) => {
    const next = value.trim() ? value.trim().split(/\s+/u) : [];
    const known = [selected.value, suggested].find(word => word && JSON.stringify(next) === JSON.stringify(word.syllables));
    if (JSON.stringify(next) !== JSON.stringify(pieces)) setDivisionEdited(true);
    setSplit(value); setDirty(true);
    setStress(values => next.map((piece, index) => (pieces[index] === piece ? values[index] : undefined) ?? known?.wordStress?.[index] ?? null));
  };
  const cancel = () => { reset(selected.value); setDirty(false); setDivisionEdited(false); setError(""); onDone(); };
  const save = async () => {
    if (!valid) return;
    setBusy(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision || !divisionEdited && !sameSplit(selected.value.syllables)) throw new Error(t("lyrics.document.annotationsChanged"));
      const answer = await client.api.chooseSyllables({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation?.revision ?? 0,
        line: selected.line, word: selected.word, pronunciation: true, emphasis: false, value: { text: selected.value.text, syllables: pieces,
          stress: sameSplit(selected.value.syllables) ? selected.value.stress : pieces.map(() => null),
          ...(stress.every(value => value !== null) ? { wordStress: stress.map(value => value!) } : {}),
          ipa: sameSplit(selected.value.syllables) ? selected.value.ipa : suggested && sameSplit(suggested.syllables) ? suggested.ipa : undefined } });
      setDirty(false); setDivisionEdited(false); onSaved(answer); onDone();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <form className="lyrics-word-form" onSubmit={event => { event.preventDefault(); if (!busy) void save(); }} onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <fieldset className="lyrics-word-form__stress" aria-label={t("lyrics.document.wordStress")}>{pieces.map((piece, index) => <label key={index}>
      <span>{piece}</span><select aria-label={t("lyrics.document.stressFor", { syllable: piece, index: index + 1 })} disabled={busy} value={stress[index] ?? ""} onChange={event => { setDirty(true); setStress(values => pieces.map((_, at) => at === index ? Number(event.target.value) : values[at] ?? null)); }}>
        <option value="" disabled>{t("lyrics.document.notAnalysed")}</option><option value={0}>{t("lyrics.document.unstressed")}</option><option value={1}>{t("lyrics.document.primaryStress")}</option><option value={2}>{t("lyrics.document.secondaryStress")}</option>
      </select>
    </label>)}</fieldset>
    <details className="lyrics-word-form__division"><summary>{t("lyrics.document.syllableDivision")}</summary><input aria-label={t("lyrics.document.syllableSplit")} title={t("lyrics.document.syllableSplitHint")} value={split} disabled={busy} onChange={event => changeSplit(event.target.value)} /></details>
    {!spells && <p role="alert">{t("lyrics.document.retainSpelling")}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="lyrics-selection__actions"><Button type="submit" disabled={!dirty || !valid || busy}>{t("common.save")}</Button><Button variant={ButtonVariant.Quiet} disabled={busy} onClick={cancel}>{t("common.cancel")}</Button><Button variant={ButtonVariant.Quiet} title={t("lyrics.document.wordDefaultHint")} disabled={busy || !differs} onClick={() => { if (suggested) { setDirty(true); setDivisionEdited(true); reset(suggested); } }}>{t("lyrics.document.default")}</Button></div>
  </form>;
}
