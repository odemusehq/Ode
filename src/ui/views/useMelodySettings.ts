import { useCallback, useEffect, useRef, useState } from "react";
import type { MelodySetting } from "../../shared/lyrics";
import { errorMessage } from "../app/api";
import { useAppState, useClient, useReloadOnChange } from "../app/hooks";

type Settings = Readonly<Record<string, MelodySetting>>;

export interface MelodySettings {
  /** The settings shown, by section id. */
  settings: Settings;
  /** Sections whose setting is being read. */
  reading: ReadonlySet<string>;
  /** Sets the section's lines to the notes of the clip selected in Live and shows the result. */
  show: (sectionId: string) => void;
  hide: (sectionId: string) => void;
}

/** "Set to melody" for each section; while a setting shows, it is read again after a new version or a lead-sheet change. */
export function useMelodySettings(): MelodySettings {
  const client = useClient();
  const song = useAppState((state) => state.song);
  const versionStamp = useAppState((state) => state.versionStamp);
  const [settings, setSettings] = useState<Settings>({});
  const [reading, setReading] = useState<ReadonlySet<string>>(() => new Set());
  const latest = useRef({ settings, song });
  /** The latest request for each section; an answer to an older one, or to one hidden since, is dropped. */
  const tickets = useRef(new Map<string, number>());

  useEffect(() => {
    latest.current = { settings, song };
  }, [settings, song]);

  const read = useCallback(
    async (sectionId: string) => {
      const ticket = (tickets.current.get(sectionId) ?? 0) + 1;
      tickets.current.set(sectionId, ticket);
      const isLatest = () => tickets.current.get(sectionId) === ticket;
      setReading((sections) => withSection(sections, sectionId, true));
      try {
        const setting = await client.api.setToMelody({ section: sectionId });
        if (isLatest()) setSettings((shown) => ({ ...shown, [sectionId]: setting }));
      } catch (error) {
        if (isLatest()) client.store.setError(errorMessage(error));
      } finally {
        if (isLatest()) setReading((sections) => withSection(sections, sectionId, false));
      }
    },
    [client],
  );

  const hide = useCallback((sectionId: string) => {
    tickets.current.set(sectionId, (tickets.current.get(sectionId) ?? 0) + 1);
    setSettings((shown) => withoutSection(shown, sectionId));
    setReading((sections) => withSection(sections, sectionId, false));
  }, []);

  const readAgain = useCallback(() => {
    const { settings: shown, song: current } = latest.current;
    for (const sectionId of Object.keys(shown)) {
      if (current?.sections.some((section) => section.id === sectionId)) void read(sectionId);
      else hide(sectionId);
    }
  }, [read, hide]);

  useReloadOnChange(song, readAgain);
  useReloadOnChange(versionStamp, readAgain);

  const show = useCallback((sectionId: string) => void read(sectionId), [read]);

  return { settings, reading, show, hide };
}

function withSection(sections: ReadonlySet<string>, sectionId: string, included: boolean): ReadonlySet<string> {
  if (sections.has(sectionId) === included) return sections;
  const next = new Set(sections);
  if (included) next.add(sectionId);
  else next.delete(sectionId);
  return next;
}

function withoutSection(settings: Settings, sectionId: string): Settings {
  if (!(sectionId in settings)) return settings;
  const next = { ...settings };
  delete next[sectionId];
  return next;
}
