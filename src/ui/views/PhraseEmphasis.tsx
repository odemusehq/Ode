import { useState, type ReactNode } from "react";
import type { LyricsState } from "../../shared/lyrics";
import type { LyricsEmphasisWrite } from "../../shared/lyrics-document";
import { LyricsDocument } from "../../shared/lyrics-document";
import { LyricsSections } from "../../shared/lyrics-sections";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant, Select } from "../../ui-kit";
import { useClient } from "../app/hooks";
import { errorMessage } from "../app/api";
import { MarkLayout } from "./mark-layout";
import type { LineSelection } from "./LyricsTextEditor";

type Change = LyricsEmphasisWrite["changes"][number];
const key = (change: Pick<Change, "word" | "syllable">) => `${change.word}/${change.syllable}`;
const LEVELS = [{ value: "0", label: t("lyrics.document.unemphasised") }, { value: "2", label: t("lyrics.document.secondaryEmphasis") }, { value: "1", label: t("lyrics.document.emphasised") }];

/** One phrase in context; patches are literal musician choices, not an emphasis algorithm. */
export function PhraseEmphasis({ selection, state, onSaved, onDone }: { selection: LineSelection; state: LyricsState; onSaved: (state: LyricsState) => void; onDone: () => void }) {
  const client = useClient();
  const [changes, setChanges] = useState<Change[]>([]);
  const [target, setTarget] = useState<Omit<Change, "value"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = (change: Omit<Change, "value">) => { const word = selection.check.words[change.word]; return word?.text === change.text && JSON.stringify(word.syllables) === JSON.stringify(change.syllables); };
  const stale = changes.some(change => !matches(change));
  const targetValid = target && matches(target);
  const value = targetValid ? changes.find(change => key(change) === key(target))?.value ?? selection.check.words[target.word]?.stress[target.syllable] ?? null : null;
  const sungLine = state.text.split("\n").slice(0, selection.line).filter(LyricsSections.isSung).length - 1;
  const automatic = state.notation && LyricsDocument.check({ ...state.notation, choices: [] }, state.text)?.lines[sungLine];
  const defaults: Change[] = [];
  selection.check.words.forEach((word, index) => {
    const saved = state.notation?.choices.find(choice => !choice.stale && choice.line === selection.line && choice.word === index && choice.lineText === selection.text);
    const original = [saved?.default, automatic?.words[index]].find(value => value?.text === word.text && JSON.stringify(value.syllables) === JSON.stringify(word.syllables));
    if (!original) return;
    original.stress.forEach((level, syllable) => { if (level !== null && level !== word.stress[syllable]) defaults.push({ word: index, text: word.text, syllables: word.syllables, syllable, value: level }); });
  });
  const setValue = (level: string) => {
    if (!targetValid || level === "") return;
    const change = { ...target, value: Number(level) };
    setChanges(values => [...values.filter(item => key(item) !== key(change)), change]);
  };
  const cancel = () => { setChanges([]); setError(""); onDone(); };
  const save = async () => {
    if (!changes.length || stale) return;
    setBusy(true); setError("");
    try {
      if (!await client.lyrics.flush()) return;
      const current = client.lyrics.getSnapshot().stored;
      if (!current || current.songId !== state.songId || current.revision !== state.revision || current.notation?.revision !== state.notation?.revision) throw new Error(t("lyrics.document.annotationsChanged"));
      const answer = await client.api.setPhraseEmphasis({ songId: state.songId, baseRevision: state.revision, notationRevision: state.notation?.revision ?? 0, line: selection.line, changes });
      setChanges([]); onSaved(answer); onDone();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const content: ReactNode[] = [];
  let cursor = 0;
  for (const located of MarkLayout.locate(selection.text, selection.check)) {
    const word = selection.check.words[located.index]!;
    content.push(selection.text.slice(cursor, located.start));
    if (!located.syllables.length) { content.push(selection.text.slice(located.start, located.end)); cursor = located.end; continue; }
    let offset = located.start;
    content.push(<span key={located.index} className="phrase-emphasis__word">{word.syllables.map((piece, syllable) => {
      const text = selection.text.slice(offset, offset + piece.length); offset += piece.length;
      const selected = targetValid && target.word === located.index && target.syllable === syllable;
      const changed = changes.find(change => change.word === located.index && change.syllable === syllable && matches(change));
      return <button key={syllable} type="button" className="phrase-emphasis__syllable" data-emphasis={changed?.value ?? word.stress[syllable] ?? "unknown"} aria-pressed={Boolean(selected)} aria-label={t("lyrics.document.phraseSyllable", { syllable: piece, word: word.text })} title={t("lyrics.document.phraseSyllable", { syllable: piece, word: word.text })} disabled={busy} onClick={() => setTarget({ word: located.index, text: word.text, syllables: [...word.syllables], syllable })}>{text}</button>;
    })}</span>);
    cursor = located.end;
  }
  content.push(selection.text.slice(cursor));
  return <form className="phrase-emphasis" aria-label={t("lyrics.document.sentenceEmphasis")} onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <div className="phrase-emphasis__text">{content}</div>
    <label className="phrase-emphasis__level"><span>{t("lyrics.document.emphasis")}</span><Select aria-label={t("lyrics.document.emphasis")} disabled={busy || !targetValid} value={value === null ? "" : String(value)} options={[{ value: "", label: t(targetValid ? "lyrics.document.notAnalysed" : "lyrics.document.selectSyllable") }, ...LEVELS]} onChange={setValue} /></label>
    {(stale || error) && <p role="alert">{stale ? t("lyrics.document.annotationsChanged") : error}</p>}
    {(selection.check.review?.length ?? 0) > 0 && <details className="lyrics-selection__review"><summary>{t("lyrics.document.phraseReview")}</summary><ul>{selection.check.review!.map((review, at) => <li key={at}>{review}</li>)}</ul></details>}
    <div className="lyrics-selection__actions"><Button type="submit" disabled={busy || stale || !changes.length}>{t("common.save")}</Button><Button variant={ButtonVariant.Quiet} disabled={busy} onClick={cancel}>{t("common.cancel")}</Button><Button variant={ButtonVariant.Quiet} title={t("lyrics.document.phraseDefaultHint")} disabled={busy || !defaults.length && !changes.length} onClick={() => { setChanges(defaults); setError(""); }}>{t("lyrics.document.default")}</Button></div>
  </form>;
}
