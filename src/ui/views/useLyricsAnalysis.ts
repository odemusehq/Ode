import { useEffect, useRef, useState } from "react";
import type { LyricsAnalysis } from "../../shared/lyrics";
import type { Section } from "../../shared/song";
import { errorMessage } from "../app/api";
import { UI_CONFIG } from "../app/config";
import { Debouncer } from "../app/debounce";
import { useClient } from "../app/hooks";

export interface LyricsChecks {
  analyses: Readonly<Record<string, LyricsAnalysis>>;
  errors: Readonly<Record<string, string>>;
}

const NO_CHECKS: LyricsChecks = { analyses: {}, errors: {} };

/** Checks each section's lines with the server shortly after they change. */
export function useLyricsAnalysis(sections: readonly Section[]): LyricsChecks {
  const client = useClient();
  const [checks, setChecks] = useState<LyricsChecks>(NO_CHECKS);
  const requested = useRef(new Map<string, string>());
  const debouncers = useRef(new Map<string, Debouncer>());

  useEffect(() => {
    for (const section of sections) {
      const lines = section.lines.map((line) => line.text);
      const key = JSON.stringify(lines);
      if (requested.current.get(section.id) === key) continue;
      requested.current.set(section.id, key);
      const isCurrent = () => requested.current.get(section.id) === key;
      debouncerFor(debouncers.current, section.id).schedule(() => {
        client.api.analyzeLyrics({ lines }).then(
          (analysis) => {
            if (isCurrent()) setChecks((current) => withAnalysis(current, section.id, analysis));
          },
          (error: unknown) => {
            if (isCurrent()) setChecks((current) => withError(current, section.id, errorMessage(error)));
          },
        );
      });
    }
  }, [sections, client]);

  useEffect(() => {
    const pending = debouncers.current;
    const keys = requested.current;
    return () => {
      for (const debouncer of pending.values()) debouncer.cancel();
      keys.clear();
    };
  }, []);

  return checks;
}

function debouncerFor(debouncers: Map<string, Debouncer>, sectionId: string): Debouncer {
  const existing = debouncers.get(sectionId);
  if (existing) return existing;
  const created = new Debouncer(UI_CONFIG.lyricsAnalyzeDelayMs);
  debouncers.set(sectionId, created);
  return created;
}

function withAnalysis(checks: LyricsChecks, sectionId: string, analysis: LyricsAnalysis): LyricsChecks {
  const errors = { ...checks.errors };
  delete errors[sectionId];
  return { analyses: { ...checks.analyses, [sectionId]: analysis }, errors };
}

function withError(checks: LyricsChecks, sectionId: string, message: string): LyricsChecks {
  return { analyses: checks.analyses, errors: { ...checks.errors, [sectionId]: message } };
}
