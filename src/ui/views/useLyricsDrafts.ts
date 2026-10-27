import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeadSheet, Section, SectionKind } from "../../shared/song";
import { errorMessage } from "../app/api";
import { UI_CONFIG } from "../app/config";
import { Debouncer } from "../app/debounce";
import { beatsPerBar } from "../app/format";
import { useClient } from "../app/hooks";
import { newId } from "../app/ids";
import { SECTION_KIND_LABELS } from "./section-kinds";

export type LeadSheetLine = Section["lines"][number];

export enum SaveState {
  Saved = "saved",
  Waiting = "waiting",
  Saving = "saving",
  Failed = "failed",
}

type Drafts = Readonly<Record<string, LeadSheetLine[]>>;

export interface LyricsDrafts {
  /** The lead sheet's sections with unsaved edits applied. */
  sections: readonly Section[];
  updateLines: (sectionId: string, lines: LeadSheetLine[]) => void;
  addSection: (kind: SectionKind) => void;
  saveState: SaveState;
  saveError: string | null;
}

/** Lyric edits kept locally and saved to the lead sheet shortly after typing stops. */
export function useLyricsDrafts(song: LeadSheet | null): LyricsDrafts {
  const client = useClient();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saveState, setSaveState] = useState<SaveState>(SaveState.Saved);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef({ song, drafts });
  const saver = useMemo(() => new Debouncer(UI_CONFIG.lyricsSaveDelayMs), []);

  useEffect(() => {
    latest.current = { song, drafts };
  }, [song, drafts]);

  const persist = useCallback(
    async (next: LeadSheet, saved: Drafts) => {
      setSaveState(SaveState.Saving);
      try {
        await client.saveSong(next);
        setDrafts((current) => withoutSaved(current, saved));
        setSaveState(SaveState.Saved);
        setSaveError(null);
      } catch (error) {
        setSaveState(SaveState.Failed);
        setSaveError(errorMessage(error));
      }
    },
    [client],
  );

  const saveDrafts = useCallback(() => {
    const { song: current, drafts: pending } = latest.current;
    if (current && Object.keys(pending).length > 0) void persist(applyDrafts(current, pending), pending);
  }, [persist]);

  useEffect(() => () => saver.flush(), [saver]);

  const updateLines = useCallback(
    (sectionId: string, lines: LeadSheetLine[]) => {
      setDrafts((current) => ({ ...current, [sectionId]: lines }));
      setSaveState(SaveState.Waiting);
      saver.schedule(saveDrafts);
    },
    [saver, saveDrafts],
  );

  const addSection = useCallback(
    (kind: SectionKind) => {
      const { song: current, drafts: pending } = latest.current;
      if (!current) return;
      saver.cancel();
      const base = applyDrafts(current, pending);
      void persist({ ...base, sections: [...base.sections, newSection(base, kind)] }, pending);
    },
    [saver, persist],
  );

  const sections = useMemo(() => (song ? applyDrafts(song, drafts).sections : []), [song, drafts]);

  return { sections, updateLines, addSection, saveState, saveError };
}

function applyDrafts(song: LeadSheet, drafts: Drafts): LeadSheet {
  const sections = song.sections.map((section) => {
    const lines = drafts[section.id];
    return lines ? { ...section, lines } : section;
  });
  return { ...song, sections };
}

function withoutSaved(current: Drafts, saved: Drafts): Drafts {
  const remaining: Record<string, LeadSheetLine[]> = {};
  for (const [sectionId, lines] of Object.entries(current)) {
    if (saved[sectionId] !== lines) remaining[sectionId] = lines;
  }
  return remaining;
}

function newSection(song: LeadSheet, kind: SectionKind): Section {
  const end = song.sections.reduce((last, section) => Math.max(last, section.startBeat + section.lengthBeats), 0);
  const number = song.sections.filter((section) => section.kind === kind).length + 1;
  return {
    id: newId(),
    kind,
    name: `${SECTION_KIND_LABELS[kind]} ${number}`,
    startBeat: end,
    lengthBeats: UI_CONFIG.newSectionBars * beatsPerBar(song),
    lines: [{ id: newId(), text: "" }],
    chords: [],
  };
}
