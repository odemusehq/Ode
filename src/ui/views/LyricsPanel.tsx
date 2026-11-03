import { LyricsDocument } from "../../shared/lyrics-document";
import { t } from "../../shared/i18n";
import type { LyricsCheck } from "../../shared/lyrics";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LyricsSections, type LyricsSection } from "../../shared/lyrics-sections";
import { Button, ButtonVariant, Icon, IconName, Menu, MenuAlign, cx } from "../../ui-kit";
import { useClient, useLyrics } from "../app/hooks";
import { LyricsMarks, SupportStatus } from "../app/lyrics-marks";
import { LyricsViewStore, type LyricsView } from "../app/lyrics-view";
import { LyricsTextEditor, type LyricsTextEditorHandle, type WordSelection } from "./LyricsTextEditor";
import { SyllableChoice } from "./SyllableChoice";
import { SectionAction, SectionCard, type SectionQuestion } from "./SectionCard";
import { SectionMover } from "./section-pointer";
import { MarkLayout } from "./mark-layout";
import "./LyricsPanel.css";

/** The View menu: which of Lyrics support's marks the editor shows. */
const VIEW_ITEMS: readonly { id: keyof LyricsView; label: string; description: string }[] = [
  { id: "syllables", label: t("lyrics.view.syllables"), description: t("lyrics.view.syllablesDescription") },
  { id: "counts", label: t("lyrics.view.counts"), description: t("lyrics.view.countsDescription") },
  { id: "stress", label: t("lyrics.view.stress"), description: t("lyrics.view.stressDescription") },
  { id: "details", label: t("lyrics.view.details"), description: t("lyrics.view.detailsDescription") },
  { id: "rhymes", label: t("lyrics.view.rhymes"), description: t("lyrics.view.rhymesDescription") },
];

/** What the notice says while Lyrics support is quiet. */
const SUPPORT_MESSAGES: Readonly<Record<SupportStatus.Setup | SupportStatus.Unreachable, string>> = {
  [SupportStatus.Setup]: t("lyrics.supportSetup"),
  [SupportStatus.Unreachable]: t("lyrics.supportUnavailable"),
};

/** The song's lyrics as sections that the musician and Ode both edit. */
export function LyricsPanel({ settingsRevision = 0 }: { settingsRevision?: number }) {
  const client = useClient();
  const { text, stored, saveError, loadError } = useLyrics();
  const titleId = useId();
  const strictRhymes = stored?.strictRhymes;

  return (
    <section className="lyrics" aria-labelledby={titleId}>
      <h2 id={titleId} className="ode-visually-hidden">
        {t("common.lyrics")}
      </h2>
      {stored ? (
        <LyricsEditor key={stored.songId} text={text} strictRhymes={strictRhymes ?? []} settingsRevision={settingsRevision}
          initial={stored.check && !LyricsDocument.needsAnalysis(stored.notation, stored.text) ? { lines: stored.text.split("\n").filter(LyricsSections.isSung).map(line => line.trim()), check: stored.check } : undefined} />
      ) : loadError ? (
        <ProblemLine message={loadError} onRetry={() => void client.lyrics.load()} />
      ) : (
        <p className="lyrics__reading">{t("lyrics.reading")}</p>
      )}
      {saveError && <ProblemLine message={saveError} onRetry={() => client.lyrics.retrySave()} />}
    </section>
  );
}

interface LyricsEditorProps {
  text: string;
  settingsRevision: number;
  initial?: { lines: readonly string[]; check: LyricsCheck };
  /** The names of the sections that ask for perfect rhymes. */
  strictRhymes: readonly string[];
}

interface CardQuestion {
  index: number;
  question: SectionQuestion;
}

/** A pending operation identifies the original section, never an old whole-song array. */
interface SectionIntent { section: string; index: number; names: (string | null)[] }

/**
 * One lyric document with section controls. Every change becomes the whole text again, labels included, so Ode reads and writes the
 * same text the musician sees; sections that share a name are linked copies and change together.
 */
function LyricsEditor({ text, strictRhymes, settingsRevision, initial }: LyricsEditorProps) {
  const client = useClient();
  const { stored } = useLyrics();
  const editor = useRef<LyricsTextEditorHandle>(null);
  const [word, setWord] = useState<WordSelection | null>(null);
  const sections = useMemo(() => LyricsSections.parse(text), [text]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const renamingNow = useRef<number | null>(null);
  const renamingTarget = useRef<SectionIntent | null>(null);
  const [asking, setAsking] = useState<CardQuestion | null>(null);
  const [partners, setPartners] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLDivElement>(null);
  // Seed a new window from the saved assessment; a settings change must request the new model's marks.
  const marks = useMemo(() => new LyricsMarks(client.api, settingsRevision === 0 ? initial : undefined, () => client.lyrics.flush()), [client.api, settingsRevision]);
  useEffect(() => () => marks.dispose(), [marks]);
  const support = useSyncExternalStore(marks.subscribe, marks.getSnapshot);
  const [view, setView] = useState<LyricsView>(() => LyricsViewStore.load());
  const [retries, setRetries] = useState(0);

  const sung = useMemo(() => sections.flatMap((section) => section.lines.filter(LyricsSections.isSung).map(line => line.trim())), [sections]);
  const checks = useMemo(() => stored?.text === text && stored.check ? stored.check.lines : marks.marksFor(sung), [stored, text, sung, marks, support.version]);
  let offset = 0;
  const starts = sections.map((section) => { const start = offset; offset += section.lines.filter(LyricsSections.isSung).length; return start; });
  // One shared assessment keeps rhyme sound identities consistent across every section.
  useEffect(() => { marks.request(sung); }, [sung, marks, retries, stored?.revision]);

  const toggleView = (mark: keyof LyricsView) => {
    const next = { ...view, [mark]: !view[mark] };
    setView(next);
    LyricsViewStore.save(next);
  };

  const save = (next: LyricsSection[]) => {
    const text = LyricsSections.join(next);
    if (editor.current) editor.current.replace(text);
    else client.lyrics.edit(text);
  };
  const intent = (index: number): SectionIntent => ({ section: JSON.stringify(sections[index]), index, names: sections.map((section) => section.name) });
  const changeLatest = (targets: SectionIntent[], change: (current: LyricsSection[], positions: number[]) => LyricsSection[]) => {
    const current = LyricsSections.parse(client.lyrics.getSnapshot().text);
    const positions = targets.map((target) => {
      const matches = current.flatMap((section, index) => JSON.stringify(section) === target.section ? [index] : []);
      if (matches.length === 1) return matches[0]!;
      // Identical linked copies need unchanged ordering to identify the selected copy safely.
      if (matches.includes(target.index) && JSON.stringify(current.map((section) => section.name)) === JSON.stringify(target.names)) return target.index;
      return -1;
    });
    if (positions.includes(-1)) {
      client.store.setError(t("lyrics.sectionChanged"));
      return;
    }
    save(change(current, positions));
  };
  const copiesOf = (name: string | null) => (name === null ? 1 : sections.filter((section) => section.name === name).length);

  const rename = (index: number | null) => {
    const current = LyricsSections.parse(client.lyrics.getSnapshot().text);
    renamingTarget.current = index === null || !current[index] ? null : { section: JSON.stringify(current[index]), index, names: current.map(section => section.name) };
    renamingNow.current = index;
    setRenaming(index);
  };

  /** Asks in a card; `onCancel` runs for the other choice, after the question closes. */
  const ask = (index: number, question: Omit<SectionQuestion, "onCancel">, onCancel?: () => void) =>
    setAsking({
      index,
      question: {
        ...question,
        onCancel: () => {
          setAsking(null);
          onCancel?.();
        },
      },
    });

  /** Renames a section; a name another section has asks to link them first. */
  const setName = (index: number, name: string) => {
    if (renamingNow.current !== index) return;
    const original = renamingTarget.current;
    rename(null);
    const section = sections[index];
    if (!section || name === section.name) return;
    const existing = sections.find((other, at) => at !== index && other.name === name);
    if (!existing) {
      if (original) changeLatest([original], (current, [to]) => current.map((each, at) => at === to ? { ...each, name } : each));
      return;
    }
    const target = original ?? intent(index);
    const source = intent(sections.indexOf(existing));
    ask(
      index,
      {
        message: t("lyrics.confirmExistingSection", { name: (name) }),
        confirmLabel: t("lyrics.link"),
        cancelLabel: t("lyrics.keepSeparate"),
        onConfirm: () => {
          setAsking(null);
          changeLatest([target, source], (current, [to, from]) => current.map((each, at) => at === to ? { name, lines: [...current[from!]!.lines] } : each));
        },
      },
      () => changeLatest([target], (current, [to]) => current.map((each, at) => at === to ? { ...each, name: LyricsSections.freeName(current, name) } : each)),
    );
  };

  const act = (index: number, action: SectionAction) => {
    const section = sections[index];
    if (!section) return;
    const insert = (copy: LyricsSection) => save([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    switch (action) {
      case SectionAction.Duplicate:
        insert({ name: LyricsSections.freeName(sections, section.name ?? t("lyrics.section")), lines: [...section.lines] });
        return;
      case SectionAction.LinkedCopy:
        insert({ name: section.name, lines: [...section.lines] });
        return;
      case SectionAction.Unlink: {
        const name = LyricsSections.freeName(sections, LyricsSections.baseName(section.name ?? t("lyrics.section")));
        save(sections.map((each, at) => at === index ? { ...each, name } : each));
        rename(index);
        return;
      }
      case SectionAction.Delete:
        const target = intent(index);
        ask(index, {
          message: t("lyrics.confirmDeleteSection", { name: (section.name), hasName: ((section.name) != null) }),
          confirmLabel: t("common.delete"),
          onConfirm: () => {
            setAsking(null);
            changeLatest([target], (current, [to]) => current.filter((_, at) => at !== to));
          },
        });
    }
  };

  const move = (from: number, to: number) => {
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    save(next);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-index="${to}"] .section__grip`)?.focus());
  };

  /** Links a section to another: after a yes, the target takes the section's name and lines. */
  const link = (from: number, to: number) => {
    const source = sections[from];
    const target = sections[to];
    if (!source || !target || source.name === null) return;
    const sourceIntent = intent(from);
    const targetIntent = intent(to);
    ask(to, {
      message: t("lyrics.confirmReplaceAndLink", { target: (target.name), hasTarget: ((target.name) != null), source: (source.name) }),
      confirmLabel: t("lyrics.replaceAndLink"),
      onConfirm: () => {
        setAsking(null);
        changeLatest([sourceIntent, targetIntent], (current, [sourceAt, targetAt]) => current.map((each, at) => at === targetAt ? { name: current[sourceAt!]!.name, lines: [...current[sourceAt!]!.lines] } : each));
      },
    });
  };

  const addSection = () => {
    const name = LyricsSections.freeName(sections, t("lyrics.section"));
    save([...sections, { name, lines: [""] }]);
    rename(sections.length);
  };

  const headers = sections.map((section, index) => (
          <SectionCard
            key={index}
            section={section}
            index={index}
            copies={copiesOf(section.name)}
            renaming={renaming === index}
            question={asking?.index === index ? asking.question : null}
            partner={partners !== null && section.name === partners}
            onRename={() => rename(index)}
            onName={(name) => setName(index, name)}
            onStopRenaming={() => rename(null)}
            onAction={(action) => act(index, action)}
            onGrip={(event) => {
              if (!list.current || !indicator.current) return;
              event.preventDefault();
              new SectionMover(list.current, indicator.current).start(index, move);
            }}
            onStep={(direction) => {
              const to = index + direction;
              if (to >= 0 && to < sections.length) move(index, to);
            }}
            linkTargets={sections.flatMap((other, at) => at !== index && other.name !== section.name ? [{ id: String(at), label: other.name ?? t("lyrics.untitledSection", { index: (at + 1) }) }] : [])}
            onLinkTo={(to) => link(index, to)}
            onPartners={(show) => setPartners(show ? section.name : null)}
            analysis={view.details && <details className="section__analysis"><summary>{t("lyrics.lineAnalysisTitle")}</summary><ol>
              {section.lines.filter(LyricsSections.isSung).map((line, lineIndex) => {
                const check = checks[starts[index]! + lineIndex];
                return <li key={lineIndex}><p>{line}</p>{check ? <p>
                  {t("lyrics.lineAnalysis", { count: (MarkLayout.count(check)), words: (check.words.map((word) => t("lyrics.wordAnalysis", { word: (word.text), syllables: (word.syllables.map((syllable, at) => t("lyrics.syllableAnalysis", { syllable: (syllable), stress: (word.stress[at]) }))).join(", ") })).join("; ")), rhyme: (t("lyrics.rhymeAnalysis", { hasLetter: Boolean((check.rhyme.letter)), letter: (check.rhyme.letter), quality: (check.rhyme.quality), hasPart: Boolean((check.rhyme.part)), part: (check.rhyme.part) })) })}
                  {check.rhyme.sound && <code> {check.rhyme.sound}</code>}
                </p> : <p>{t("lyrics.analysisUnavailable")}</p>}</li>;
              })}
            </ol></details>}
            extras={
              section.name !== null && (
                <StrictToggle
                  on={strictRhymes.includes(section.name)}
                  onChange={(strict) => {
                    if (section.name !== null) void client.lyrics.setStrictRhymes(section.name, strict).catch(() => undefined);
                  }}
                />
              )
            }
          />
        ));

  return (
    <div
      className={cx(
        "lyrics-editor",
        !view.syllables && "lyrics-editor--no-syllables",
        !view.counts && "lyrics-editor--no-counts",
        !view.stress && "lyrics-editor--no-stress",
        !view.rhymes && "lyrics-editor--no-rhymes",
      )}
    >
      <div className="lyrics-editor__toolbar">
        <Menu
          label={t("common.view")}
          buttonText={t("common.view")}
          items={VIEW_ITEMS.map((item) => ({ ...item, checked: view[item.id] }))}
          multiple
          onSelect={toggleView}
          align={MenuAlign.End}
        />
      </div>
      <div ref={list} className="lyrics-editor__sections">
        <div ref={indicator} className="lyrics-editor__drop" hidden />
        <LyricsTextEditor ref={editor} text={text} checks={checks} view={view} strictRhymes={strictRhymes} headers={headers}
          onChange={(next) => client.lyrics.edit(next)}
          onWord={(next) => setWord(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)} />
        <Button variant={ButtonVariant.Quiet} className="lyrics-editor__add" onClick={addSection}>
          <Icon name={IconName.Plus} />
          {t("lyrics.section")}
        </Button>
      </div>
      {word && stored && stored.text === text && <SyllableChoice key={`${word.line}:${word.word}:${JSON.stringify(word.value)}`} selected={word} state={stored}
        onSaved={(state) => { client.lyrics.receive(state); marks.retry(); setRetries(count => count + 1); }} onDone={() => editor.current?.focus()} />}
      {support.status !== SupportStatus.Ready && (
        <SupportNotice
          status={support.status}
          detail={support.detail}
          onRetry={() => {
            marks.retry();
            setRetries((count) => count + 1);
          }}
        />
      )}
    </div>
  );
}

interface StrictToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

/** A perfect-rhyme preference for linked sections; near rhymes are marked for review. */
function StrictToggle({ on, onChange }: StrictToggleProps) {
  return (
    <button
      type="button"
      className={cx("section__strict", on && "section__strict--on")}
      aria-pressed={on}
      title={t("lyrics.strictRhymesHint")}
      onClick={() => onChange(!on)}
    >
      <Icon name={IconName.Lock} />
      {t("lyrics.strictRhymes")}
    </button>
  );
}

interface SupportNoticeProps {
  status: SupportStatus.Setup | SupportStatus.Unreachable;
  detail: string;
  onRetry: () => void;
}

/** A bar along the bottom of the editor while Lyrics support is quiet, saying why, with a way to ask again. */
function SupportNotice({ status, detail, onRetry }: SupportNoticeProps) {
  const setup = status === SupportStatus.Setup;
  return (
    <div className={cx("lyrics-notice", setup && "lyrics-notice--setup")} role="status" title={detail || undefined}>
      <Icon name={setup ? IconName.Info : IconName.Alert} />
      <p className="lyrics-notice__text">{SUPPORT_MESSAGES[status]}</p>
      {!setup && <Button variant={ButtonVariant.Quiet} onClick={onRetry}>
        {t("common.retry")}
      </Button>}
    </div>
  );
}

interface ProblemLineProps {
  message: string;
  onRetry: () => void;
}

function ProblemLine({ message, onRetry }: ProblemLineProps) {
  return (
    <div className="lyrics__problem" role="alert">
      <p className="lyrics__problem-text">{message}</p>
      <Button onClick={onRetry}>{t("common.retry")}</Button>
    </div>
  );
}
