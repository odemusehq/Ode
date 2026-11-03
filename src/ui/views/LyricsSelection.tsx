import { useEffect, useId, useState } from "react";
import type { LyricsState } from "../../shared/lyrics";
import { t } from "../../shared/i18n";
import { Button, ButtonVariant, IconButton, IconName } from "../../ui-kit";
import { SyllableChoice } from "./SyllableChoice";
import { PhraseEmphasis } from "./PhraseEmphasis";
import { LyricNote } from "./LyricNote";
import type { LineSelection } from "./LyricsTextEditor";

/** The selection's scope stays explicit. Switching views never switches the chat or the DAW. */
export function LyricsSelection({ selection, state, onSaved, onDone }: { selection: LineSelection; state: LyricsState; onSaved: (state: LyricsState) => void; onDone: () => void }) {
  const [panel, setPanel] = useState<"word" | "phrase" | "melody" | null>(selection.range && !selection.word ? "phrase" : null);
  const id = useId();
  useEffect(() => { if (selection.range && !selection.word) setPanel("phrase"); }, [selection.range, selection.word]);
  const lineBindings = state.notation?.clips.flatMap(clip => clip.bindings.filter(binding => binding.line === selection.line).map(binding => ({ ...binding, clipId: clip.id, actual: binding.notes.flatMap(index => clip.notes[index] ? [{ index, note: clip.notes[index]! }] : []) }))) ?? [];
  const bindings = lineBindings.filter(binding => !binding.stale && binding.text === selection.text && (!selection.word || binding.word === selection.word.word));
  const pending = lineBindings.some(binding => binding.stale || binding.text !== selection.text);
  const hasMelody = bindings.length > 0 || pending;
  const done = () => { setPanel(null); onDone(); };
  const toggle = (view: "word" | "phrase" | "melody") => setPanel(current => current === view ? null : view);
  return <section className="lyrics-selection" aria-label={t("lyrics.document.selectionDetails")}>
    <div className="lyrics-selection__scopes">
      <Button variant={ButtonVariant.Quiet} disabled={!selection.word} aria-expanded={panel === "word"} aria-controls={`${id}-word`} title={t("lyrics.document.editPronunciation")} onClick={() => toggle("word")}>{t("lyrics.document.word")}</Button>
      <Button variant={ButtonVariant.Quiet} aria-expanded={panel === "phrase"} aria-controls={`${id}-phrase`} title={t("lyrics.document.sentenceEmphasis")} onClick={() => toggle("phrase")}>{t("lyrics.document.phrase")}</Button>
      <IconButton className="lyrics-selection__melody" icon={IconName.Music} label={t("lyrics.document.editMelody")} disabled={!hasMelody} aria-expanded={panel === "melody"} aria-controls={`${id}-melody`} onClick={() => toggle("melody")} />
    </div>
    <div id={`${id}-word`} className="lyrics-selection__body" hidden={panel !== "word" || !selection.word}>{selection.word && <SyllableChoice key={`${selection.word.word}:${selection.word.value.text}`} selected={selection.word} state={state} onSaved={onSaved} onDone={done} />}</div>
    <div id={`${id}-phrase`} className="lyrics-selection__body" hidden={panel !== "phrase"}><PhraseEmphasis selection={selection} state={state} onSaved={onSaved} onDone={done} /></div>
    <div id={`${id}-melody`} className="lyrics-selection__body lyrics-selection__music" hidden={panel !== "melody"}>
      {pending && <p>{t("lyrics.document.alignmentStale")}</p>}
      {bindings.map((binding, index) => <div key={index}><span>{selection.check.words[binding.word]?.syllables[binding.syllable] ?? ""}</span>{binding.actual.map(({ index: noteIndex, note }, at) => <LyricNote key={at} state={state} clipId={binding.clipId} noteIndex={noteIndex} note={note} syllable={selection.check.words[binding.word]?.syllables[binding.syllable] ?? ""} />)}</div>)}
    </div>
  </section>;
}
