import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { LyricsSection } from "../../shared/lyrics-sections";
import { Chip, ChipGroup, ConfirmCard, Icon, IconName, Menu, MenuAlign, TextInput, cx } from "../../ui-kit";
import { SectionText } from "./SectionText";

/** The names offered while a section is renamed; Verse takes the next free number. */
export const QUICK_NAMES = ["Verse", "Pre-chorus", "Chorus", "Bridge", "Intro", "Outro"] as const;

export enum SectionAction {
  Duplicate = "duplicate",
  LinkedCopy = "linked-copy",
  Delete = "delete",
  Unlink = "unlink",
}

/** A question a card asks before its lines change. */
export interface SectionQuestion {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface SectionCardProps {
  section: LyricsSection;
  index: number;
  /** How many sections share this one's name; above 1 they are linked copies. */
  copies: number;
  renaming: boolean;
  question: SectionQuestion | null;
  /** Lit while the musician points at a linked copy's badge. */
  partner: boolean;
  /** Controls at the right of the section's name, such as Strict rhymes. */
  extras?: ReactNode;
  /** Drawn behind the section's text, line for line. */
  renderMarks?: (lines: readonly string[]) => ReactNode;
  analysis?: ReactNode;
  onRename: () => void;
  onName: (name: string) => void;
  onQuickName: (name: string) => void;
  onStopRenaming: () => void;
  onLines: (lines: string[]) => void;
  onAction: (action: SectionAction) => void;
  onGrip: (event: PointerEvent<HTMLButtonElement>) => void;
  onStep: (direction: -1 | 1) => void;
  linkTargets: readonly { id: string; label: string }[];
  onLinkTo: (index: number) => void;
  onPartners: (show: boolean) => void;
}

const UNTITLED = "Untitled";
/** A name may hold anything a [label] can: square brackets and line breaks stay out. */
const NAME_BREAKERS = /[[\]\r\n]/g;

/** One section of the lyrics: a rail to move and link it, its name, its actions and its lines. */
export function SectionCard(props: SectionCardProps) {
  const { section, index, copies, renaming, question, partner, extras, renderMarks } = props;
  const title = section.name ?? UNTITLED;
  const linked = copies > 1;

  const actions = [
    { id: SectionAction.Duplicate, label: "Duplicate", description: "A copy to change on its own" },
    ...(section.name !== null ? [{ id: SectionAction.LinkedCopy, label: "Add a linked copy", description: "A copy that changes with this one" }] : []),
    { id: SectionAction.Delete, label: "Delete" },
  ];

  const step = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    props.onStep(direction);
  };

  return (
    <div className={cx("section", linked && "section--linked", partner && "section--partner")} data-index={index}>
      <div className="section__rail">
        <button type="button" className="section__grip" aria-label={`Move ${title}; use Up and Down arrow keys to reorder`} title="Drag to move, or use Up and Down arrow keys" onPointerDown={props.onGrip} onKeyDown={step}>
          <Icon name={IconName.Grip} />
        </button>
        <span className="section__bar" />
        {section.name !== null && (
          <Menu label={`Copy ${title} into and link to another section`} icon={IconName.Link} items={props.linkTargets} disabled={props.linkTargets.length === 0} onSelect={(id) => props.onLinkTo(Number(id))} />
        )}
      </div>
      <div className="section__body">
        <div className="section__head">
          {renaming ? (
            <NameField name={section.name ?? ""} onName={props.onName} onStop={props.onStopRenaming} />
          ) : (
            <button type="button" className={cx("section__name", section.name === null && "section__name--untitled")} title="Rename" onClick={props.onRename}>
              {title}
            </button>
          )}
          {linked && (
            <span className="section__copies" onPointerEnter={() => props.onPartners(true)} onPointerLeave={() => props.onPartners(false)}>
              <Menu
                label={`${title}, linked copies`}
                buttonText={String(copies)}
                icon={IconName.Link}
                items={[{ id: SectionAction.Unlink, label: "Unlink this copy", description: "It keeps its lines under a name of its own" }]}
                onSelect={props.onAction}
              />
            </span>
          )}
          <span className="section__spacer" />
          {extras}
          <Menu label={`${title} actions`} icon={IconName.More} items={actions} onSelect={props.onAction} align={MenuAlign.End} />
        </div>
        {renaming && (
          // The name field keeps focus through a click here, so its blur leaves a chip's choice in place.
          <div className="section__quick-names" onMouseDown={(event) => event.preventDefault()}>
            <ChipGroup label="Quick names">
              {QUICK_NAMES.map((name) => (
                <Chip key={name} onClick={() => props.onQuickName(name)}>
                  {name}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        )}
        {question && (
          <ConfirmCard
            message={question.message}
            confirmLabel={question.confirmLabel}
            cancelLabel={question.cancelLabel}
            onConfirm={question.onConfirm}
            onCancel={question.onCancel}
          />
        )}
        <SectionText lines={section.lines} label={`${title} lyrics`} onLines={props.onLines} renderMarks={renderMarks} />
        {props.analysis}
      </div>
    </div>
  );
}

interface NameFieldProps {
  name: string;
  onName: (name: string) => void;
  onStop: () => void;
}

/** The section's name, typed: Enter or leaving the field keeps it, Escape leaves the old one. */
function NameField({ name, onName, onStop }: NameFieldProps) {
  const [value, setValue] = useState(name);
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep && value.trim()) onName(value.replace(NAME_BREAKERS, "").trim());
    else onStop();
  };

  return (
    <TextInput
      ref={field}
      className="section__name-field"
      aria-label="Section name"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
    />
  );
}
