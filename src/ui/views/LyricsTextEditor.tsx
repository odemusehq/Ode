import { EditorState, StateEffect, StateField, Transaction, type Text } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, keymap, drawSelection, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LineCheck } from "../../shared/lyrics";
import { LyricsSections } from "../../shared/lyrics-sections";
import { t } from "../../shared/i18n";
import type { LyricsView } from "../app/lyrics-view";
import { lyricTextChanges } from "../app/lyrics-changes";
import { MarkLayout, RhymeColour } from "./mark-layout";

export interface WordSelection { line: number; word: number; value: LineCheck["words"][number] }
export interface LyricsTextEditorHandle { replace(text: string): void }
interface Props {
  text: string;
  checks: readonly (LineCheck | null)[];
  view: LyricsView;
  strictRhymes: readonly string[];
  headers: readonly ReactNode[];
  onChange: (text: string) => void;
  onWord: (word: WordSelection | null) => void;
}
const refresh = StateEffect.define<null>();
const remote = Transaction.userEvent.of("input.remote");

/** React owns the section controls; CodeMirror owns all text, selection, clipboard and history. */
class Header extends WidgetType {
  constructor(readonly host: HTMLElement) { super(); }
  eq(other: Header): boolean { return this.host === other.host; }
  toDOM(): HTMLElement { return this.host; }
  ignoreEvent(): boolean { return true; }
}
class Bar extends WidgetType {
  toDOM(): HTMLElement {
    const bar = document.createElement("i");
    bar.className = "mark-bar";
    bar.setAttribute("aria-hidden", "true");
    return bar;
  }
}
class Count extends WidgetType {
  constructor(readonly check: LineCheck, readonly view: LyricsView) { super(); }
  eq(other: Count): boolean { return JSON.stringify([this.check, this.view]) === JSON.stringify([other.check, other.view]); }
  toDOM(): HTMLElement {
    const meta = document.createElement("span");
    meta.className = "line-marks__meta";
    meta.setAttribute("aria-hidden", "true");
    if (this.view.rhymes && this.check.rhyme.letter) {
      const letter = document.createElement("span");
      letter.className = "line-marks__letter";
      const dot = document.createElement("i");
      dot.className = "line-marks__dot";
      meta.style.setProperty("--rhyme-rgb", `var(--rhyme-${RhymeColour.of(this.check.rhyme.letter)})`);
      letter.append(dot, this.check.rhyme.letter);
      meta.append(letter);
    }
    if (this.view.counts) {
      const count = document.createElement("span");
      count.className = "line-marks__count";
      count.textContent = String(MarkLayout.count(this.check));
      meta.append(count);
    }
    return meta;
  }
}

/** One literal document. All visible marks are decorations and never enter copied lyrics. */
export const LyricsTextEditor = forwardRef<LyricsTextEditorHandle, Props>(function LyricsTextEditor(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const current = useRef(props);
  current.current = props;
  const hosts = useRef<HTMLElement[]>([]);
  while (hosts.current.length < props.headers.length) {
    const host = document.createElement("div");
    host.className = "lyrics-document__heading";
    hosts.current.push(host);
  }

  const decorate = (doc: Text): DecorationSet => {
    const config = current.current;
    const exact = doc.toString() === config.text;
    const ranges: ReturnType<Decoration["range"]>[] = [];
    let section = 0, sung = 0, name: string | null = null;
    const firstLabel = Array.from({ length: doc.lines }, (_, at) => doc.line(at + 1)).find(line => LyricsSections.labelName(line.text) !== null);
    const prelude = !firstLabel || doc.sliceString(0, firstLabel.from).trim().length > 0;
    if (exact && prelude && hosts.current[0]) {
      ranges.push(Decoration.widget({ widget: new Header(hosts.current[0]), block: true, side: -1 }).range(0));
      section++;
    }
    for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
      const line = doc.line(lineNumber);
      const label = LyricsSections.labelName(line.text);
      if (label !== null) {
        name = label;
        const host = hosts.current[section++];
        if (exact && host) ranges.push(Decoration.replace({ widget: new Header(host), block: true, atomic: true }).range(line.from, Math.min(doc.length, line.to + 1)));
        continue;
      }
      if (!LyricsSections.isSung(line.text)) continue;
      const check = exact ? config.checks[sung++] : null;
      if (!check) continue;
      const colour = RhymeColour.of(check.rhyme.letter);
      ranges.push(Decoration.line({ attributes: { style: `--rhyme-rgb:var(--rhyme-${colour})` } }).range(line.from));
      let offset = line.from;
      for (const run of MarkLayout.runs(line.text, check)) {
        const to = offset + run.text.length;
        if (config.view.stress && run.syllable?.stressed && to > offset) ranges.push(Decoration.mark({ class: "mark-syllable mark-syllable--stressed" }).range(offset, to));
        if (config.view.syllables && run.syllable?.barBefore) ranges.push(Decoration.widget({ widget: new Bar(), side: -1 }).range(offset));
        if (config.view.rhymes && run.rhyme) {
          const near = check.rhyme.quality === "near";
          const flagged = near && name !== null && config.strictRhymes.includes(name);
          ranges.push(Decoration.mark({ class: `mark-rhyme${near ? " mark-rhyme--near" : ""}${flagged ? " mark-rhyme--flagged" : ""}` }).range(offset + run.rhyme[0], offset + run.rhyme[1]));
        }
        offset = to;
      }
      if (config.view.counts || config.view.rhymes) ranges.push(Decoration.widget({ widget: new Count(check, config.view), side: 1 }).range(line.to));
    }
    return Decoration.set(ranges, true);
  };

  useLayoutEffect(() => {
    const decorations = StateField.define<DecorationSet>({
      create: state => decorate(state.doc),
      update: (value, transaction) => transaction.docChanged || transaction.effects.some(effect => effect.is(refresh)) ? decorate(transaction.state.doc) : value,
      provide: field => [EditorView.decorations.from(field), EditorView.atomicRanges.of(view => view.state.field(field).update({ filter: (_from, _to, decoration) => decoration.spec.atomic === true }))],
    });
    const view = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: current.current.text,
        extensions: [history(), drawSelection(), EditorView.lineWrapping, keymap.of([...defaultKeymap, ...historyKeymap]), decorations,
          EditorView.contentAttributes.of({ "aria-label": t("lyrics.document.editorLabel"), spellcheck: "true" }),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !update.transactions.every(tr => tr.isUserEvent("input.remote"))) current.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(refresh)))) {
              const selection = update.state.selection.main;
              const line = update.state.doc.lineAt(selection.head);
              const config = current.current;
              const sungIndex = update.state.doc.sliceString(0, line.from).split("\n").filter(LyricsSections.isSung).length;
              const check = update.state.doc.toString() === config.text && LyricsSections.isSung(line.text) ? config.checks[sungIndex] : null;
              const word = check && MarkLayout.locate(line.text, check).find(word => selection.from >= line.from + word.start && selection.to <= line.from + word.end);
              config.onWord(word && check ? { line: line.number, word: word.index, value: check.words[word.index]! } : null);
            }
          }),
        ],
      }),
    });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const before = view.state.doc.toString(), after = props.text;
    if (before !== after) view.dispatch({ changes: lyricTextChanges(before, after), effects: refresh.of(null), annotations: [remote, Transaction.addToHistory.of(false)] });
    else view.dispatch({ effects: refresh.of(null) });
    view.requestMeasure();
  }, [props.text, props.checks, props.view, props.headers, props.strictRhymes]);

  useImperativeHandle(ref, () => ({ replace(text: string) {
    const view = editor.current;
    if (!view || view.state.doc.toString() === text) return;
    view.dispatch({ changes: lyricTextChanges(view.state.doc.toString(), text), annotations: Transaction.userEvent.of("input.section") });
  } }), []);

  return <><div ref={container} className="lyrics-document" />{props.headers.map((header, index) => createPortal(header, hosts.current[index]!, String(index)))}</>;
});

