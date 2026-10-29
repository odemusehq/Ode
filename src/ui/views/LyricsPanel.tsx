import { useId, useMemo, useRef, useState } from "react";
import { LyricsSections, type LyricsSection } from "../../shared/lyrics-sections";
import { Button, ButtonVariant, Icon, IconName } from "../../ui-kit";
import { useClient, useLyrics } from "../app/hooks";
import { SectionAction, SectionCard, type SectionQuestion } from "./SectionCard";
import { SectionLinker, SectionMover } from "./section-pointer";
import "./LyricsPanel.css";

/** The song's lyrics as sections that the musician and Ode both edit. */
export function LyricsPanel() {
  const client = useClient();
  const { text, stored, saveError, loadError } = useLyrics();
  const titleId = useId();

  return (
    <section className="lyrics" aria-labelledby={titleId}>
      <h2 id={titleId} className="ode-visually-hidden">
        Lyrics
      </h2>
      {stored ? (
        <LyricsEditor text={text} />
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
}

interface CardQuestion {
  index: number;
  question: SectionQuestion;
}

/**
 * The lyrics as section cards. Every change becomes the whole text again, labels included, so Ode reads and writes the
 * same text the musician sees; sections that share a name are linked copies and change together.
 */
function LyricsEditor({ text }: LyricsEditorProps) {
  const client = useClient();
  const sections = useMemo(() => LyricsSections.parse(text), [text]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const renamingNow = useRef<number | null>(null);
  const [asking, setAsking] = useState<CardQuestion | null>(null);
  const [partners, setPartners] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLDivElement>(null);
  const cable = useRef<SVGSVGElement>(null);

  const save = (next: LyricsSection[]) => client.lyrics.edit(LyricsSections.join(next));
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
    ask(
      index,
      {
        message: `"${name}" is already in the song. Link this section to it? Its lines take the place of these.`,
        confirmLabel: "Link",
        cancelLabel: "Keep apart",
        onConfirm: () => {
          setAsking(null);
          save(sections.map((each, at) => (at === index ? { name, lines: [...existing.lines] } : each)));
        },
      },
      () => save(sections.map((each, at) => (at === index ? { ...each, name: LyricsSections.freeName(sections, name) } : each))),
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
        ask(index, {
          message: `Delete ${section.name ?? "this section"} and its lines? History keeps the version before.`,
          confirmLabel: "Delete",
          onConfirm: () => {
            setAsking(null);
            save(sections.filter((_, at) => at !== index));
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
  };

  /** Links a section to another: after a yes, the target takes the section's name and lines. */
  const link = (from: number, to: number) => {
    const source = sections[from];
    const target = sections[to];
    if (!source || !target || source.name === null) return;
    ask(to, {
      message: `Replace the lines of ${target.name ?? "this section"} with ${source.name} and link them?`,
      confirmLabel: "Replace and link",
      onConfirm: () => {
        setAsking(null);
        save(sections.map((each, at) => (at === to ? { name: source.name, lines: [...source.lines] } : each)));
      },
    });
  };

  const addSection = () => {
    const name = LyricsSections.freeName(sections, "Section");
    save([...sections, { name, lines: [""] }]);
    rename(sections.length);
  };

  return (
    <div className="lyrics-editor">
      <div ref={list} className="lyrics-editor__sections">
        <svg ref={cable} className="lyrics-cable" aria-hidden="true" />
        <div ref={indicator} className="lyrics-editor__drop" hidden />
        {sections.map((section, index) => (
          <SectionCard
            key={`${index}:${section.name ?? ""}`}
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
            onLinkHandle={(event) => {
              if (!list.current || !cable.current) return;
              event.preventDefault();
              const accepts = (to: number) => to !== index && sections[to]?.name !== section.name;
              new SectionLinker(list.current, cable.current).start(index, event.currentTarget, accepts, link);
            }}
            onPartners={(show) => setPartners(show ? section.name : null)}
          />
        ))}
        <Button variant={ButtonVariant.Quiet} className="lyrics-editor__add" onClick={addSection}>
          <Icon name={IconName.Plus} />
          Section
        </Button>
      </div>
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
