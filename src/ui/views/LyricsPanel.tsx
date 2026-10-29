import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LyricsSections, type LyricsSection } from "../../shared/lyrics-sections";
import { Button, ButtonVariant, Icon, IconName, Menu, MenuAlign, cx } from "../../ui-kit";
import { useClient, useLyrics } from "../app/hooks";
import { LyricsMarks, SupportStatus } from "../app/lyrics-marks";
import { LyricsViewStore, type LyricsView } from "../app/lyrics-view";
import { LineMarks } from "./LineMarks";
import { SectionAction, SectionCard, type SectionQuestion } from "./SectionCard";
import { SectionMover } from "./section-pointer";
import { MarkLayout } from "./mark-layout";
import "./LyricsPanel.css";

/** The View menu: which of Lyrics support's marks the editor shows. */
const VIEW_ITEMS: readonly { id: keyof LyricsView; label: string; description: string }[] = [
  { id: "syllables", label: "Syllables", description: "Light bars between syllables" },
  { id: "counts", label: "Syllable counts", description: "The count at the end of each line" },
  { id: "stress", label: "Stress", description: "A dot under each stressed syllable" },
  { id: "rhymes", label: "Rhymes", description: "Rhyming letters in colour, stronger on near rhymes" },
];

/** What the notice says while Lyrics support is quiet. */
const SUPPORT_MESSAGES: Readonly<Record<SupportStatus.Setup | SupportStatus.Unreachable, string>> = {
  [SupportStatus.Setup]: "Syllables and rhymes appear once Lyrics support has a provider and a key in Ode: Settings.",
  [SupportStatus.Unreachable]: "Lyrics support is out of reach right now, so syllables and rhymes are paused.",
};

/** The song's lyrics as sections that the musician and Ode both edit. */
export function LyricsPanel() {
  const client = useClient();
  const { text, stored, saveError, loadError } = useLyrics();
  const titleId = useId();
  const strictRhymes = stored?.strictRhymes;

  return (
    <section className="lyrics" aria-labelledby={titleId}>
      <h2 id={titleId} className="ode-visually-hidden">
        Lyrics
      </h2>
      {stored ? (
        <LyricsEditor text={text} strictRhymes={strictRhymes ?? []} />
      ) : loadError ? (
        <ProblemLine message={loadError} onRetry={() => void client.lyrics.load()} />
      ) : (
        <p className="lyrics__reading">Reading the lyrics…</p>
      )}
      {saveError && <ProblemLine message={saveError} onRetry={() => client.lyrics.retrySave()} />}
    </section>
  );
}

interface LyricsEditorProps {
  text: string;
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
 * The lyrics as section cards. Every change becomes the whole text again, labels included, so Ode reads and writes the
 * same text the musician sees; sections that share a name are linked copies and change together.
 */
function LyricsEditor({ text, strictRhymes }: LyricsEditorProps) {
  const client = useClient();
  const sections = useMemo(() => LyricsSections.parse(text), [text]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const renamingNow = useRef<number | null>(null);
  const [asking, setAsking] = useState<CardQuestion | null>(null);
  const [partners, setPartners] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => new LyricsMarks(client.api), [client.api]);
  const support = useSyncExternalStore(marks.subscribe, marks.getSnapshot);
  const [view, setView] = useState<LyricsView>(() => LyricsViewStore.load());
  const [retries, setRetries] = useState(0);

  // Lyrics support checks each section after a pause in its typing.
  useEffect(() => {
    sections.forEach((section, index) => marks.request(String(index), section.lines.filter(LyricsSections.isSung)));
  }, [sections, marks, retries]);

  const toggleView = (mark: keyof LyricsView) => {
    const next = { ...view, [mark]: !view[mark] };
    setView(next);
    LyricsViewStore.save(next);
  };

  /** The marks behind a section's text: each sung line takes its own, labels and blank lines take none. */
  const marksBehind = (strict: boolean) => (rows: readonly string[]) => {
    const found = marks.marksFor(rows.filter(LyricsSections.isSung));
    let sung = 0;
    return rows.map((row, index) => (
      <LineMarks key={index} line={row} check={LyricsSections.isSung(row) ? (found[sung++] ?? null) : null} strict={strict} />
    ));
  };

  const save = (next: LyricsSection[]) => client.lyrics.edit(LyricsSections.join(next));
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
      client.store.setError("That section changed while the question was open. Your newer lyrics are safe; choose the section action again.");
      return;
    }
    save(change(current, positions));
  };
  const copiesOf = (name: string | null) => (name === null ? 1 : sections.filter((section) => section.name === name).length);

  const rename = (index: number | null) => {
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

  /** A section's lines, written into every linked copy. */
  const setLines = (index: number, lines: string[]) => {
    const name = sections[index]?.name ?? null;
    save(sections.map((section, at) => (at === index || (name !== null && section.name === name) ? { ...section, lines } : section)));
  };

  /** Renames a section; a name another section has asks to link them first. */
  const setName = (index: number, name: string) => {
    if (renamingNow.current !== index) return;
    rename(null);
    const section = sections[index];
    if (!section || name === section.name) return;
    const existing = sections.find((other, at) => at !== index && other.name === name);
    if (!existing) {
      save(sections.map((each, at) => (at === index ? { ...each, name } : each)));
      return;
    }
    const target = intent(index);
    const source = intent(sections.indexOf(existing));
    ask(
      index,
      {
        message: `"${name}" is already in the song. Link this section to it? Its lines take the place of these.`,
        confirmLabel: "Link",
        cancelLabel: "Keep apart",
        onConfirm: () => {
          setAsking(null);
          changeLatest([target, source], (current, [to, from]) => current.map((each, at) => at === to ? { name, lines: [...current[from!]!.lines] } : each));
        },
      },
      () => changeLatest([target], (current, [to]) => current.map((each, at) => at === to ? { ...each, name: LyricsSections.freeName(current, name) } : each)),
    );
  };

  /** A quick name: Verse takes the next free number, unless the section is a verse already. */
  const setQuickName = (index: number, name: string) => {
    const current = sections[index]?.name ?? "";
    const verse = /^Verse \d+$/;
    setName(index, name === "Verse" ? (verse.test(current) ? current : LyricsSections.freeName(sections, "Verse 1")) : name);
  };

  const act = (index: number, action: SectionAction) => {
    const section = sections[index];
    if (!section) return;
    const insert = (copy: LyricsSection) => save([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    switch (action) {
      case SectionAction.Duplicate:
        insert({ name: LyricsSections.freeName(sections, section.name ?? "Section"), lines: [...section.lines] });
        return;
      case SectionAction.LinkedCopy:
        insert({ name: section.name, lines: [...section.lines] });
        return;
      case SectionAction.Unlink: {
        const name = LyricsSections.freeName(sections, LyricsSections.baseName(section.name ?? "Section"));
        save(sections.map((each, at) => (at === index ? { ...each, name } : each)));
        rename(index);
        return;
      }
      case SectionAction.Delete:
        const target = intent(index);
        ask(index, {
          message: `Delete ${section.name ?? "this section"} and its lines? History keeps the version before.`,
          confirmLabel: "Delete",
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
      message: `Replace the lines of ${target.name ?? "this section"} with ${source.name} and link them?`,
      confirmLabel: "Replace and link",
      onConfirm: () => {
        setAsking(null);
        changeLatest([sourceIntent, targetIntent], (current, [sourceAt, targetAt]) => current.map((each, at) => at === targetAt ? { name: current[sourceAt!]!.name, lines: [...current[sourceAt!]!.lines] } : each));
      },
    });
  };

  const addSection = () => {
    const name = LyricsSections.freeName(sections, "Section");
    save([...sections, { name, lines: [""] }]);
    rename(sections.length);
  };

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
          label="View"
          buttonText="View"
          items={VIEW_ITEMS.map((item) => ({ ...item, checked: view[item.id] }))}
          multiple
          onSelect={toggleView}
          align={MenuAlign.End}
        />
      </div>
      <div ref={list} className="lyrics-editor__sections">
        <div ref={indicator} className="lyrics-editor__drop" hidden />
        {sections.map((section, index) => (
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
            onQuickName={(name) => setQuickName(index, name)}
            onStopRenaming={() => rename(null)}
            onLines={(lines) => setLines(index, lines)}
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
            linkTargets={sections.flatMap((other, at) => at !== index && other.name !== section.name ? [{ id: String(at), label: other.name ?? `Untitled section ${at + 1}` }] : [])}
            onLinkTo={(to) => link(index, to)}
            onPartners={(show) => setPartners(show ? section.name : null)}
            renderMarks={marksBehind(section.name !== null && strictRhymes.includes(section.name))}
            analysis={<details className="section__analysis"><summary>Line analysis</summary><ol>
              {section.lines.filter(LyricsSections.isSung).map((line, lineIndex) => {
                const check = marks.marksFor(section.lines.filter(LyricsSections.isSung))[lineIndex];
                return <li key={lineIndex}><p>{line}</p>{check ? <p>
                  {MarkLayout.count(check)} syllables. {check.words.map((word) => `${word.text}: ${word.syllables.map((syllable, at) => `${syllable} (${word.stress[at] === 1 ? "primary stress" : word.stress[at] === 2 ? "secondary stress" : "unstressed"})`).join(", ")}`).join("; ")}. Rhyme: {check.rhyme.letter ? `${check.rhyme.letter}, ${check.rhyme.quality}${check.rhyme.part ? `, ending ${check.rhyme.part}` : ""}` : "no partner"}.
                </p> : <p>Analysis is not available for this line yet.</p>}</li>;
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
        ))}
        <Button variant={ButtonVariant.Quiet} className="lyrics-editor__add" onClick={addSection}>
          <Icon name={IconName.Plus} />
          Section
        </Button>
      </div>
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

/** Perfect rhymes for every section with this name: near rhymes there get a dashed line, and Ode keeps the rhymes perfect. */
function StrictToggle({ on, onChange }: StrictToggleProps) {
  return (
    <button
      type="button"
      className={cx("section__strict", on && "section__strict--on")}
      aria-pressed={on}
      title="Ask for perfect rhymes in this section"
      onClick={() => onChange(!on)}
    >
      <Icon name={IconName.Lock} />
      Strict rhymes
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
  return (
    <div className="lyrics-notice" role="status" title={detail || undefined}>
      <Icon name={IconName.Alert} />
      <p className="lyrics-notice__text">{SUPPORT_MESSAGES[status]}</p>
      <Button variant={ButtonVariant.Quiet} onClick={onRetry}>
        Try again
      </Button>
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
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
