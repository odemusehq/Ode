import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { errorMessage } from "./api";
import type { OdeClient } from "./client";
import type { AppState } from "./model";
import type { LyricsSnapshot } from "./shared-lyrics";

export const ClientContext = createContext<OdeClient | null>(null);

export function useClient(): OdeClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("useClient needs a ClientContext provider above it");
  return client;
}

/** Reads part of the app state. The selector must return a value stored in the state, not a new object. */
export function useAppState<T>(select: (state: AppState) => T): T {
  const { store } = useClient();
  return useSyncExternalStore(store.subscribe, () => select(store.getSnapshot()));
}

/** The shared lyrics as the panel shows them. */
export function useLyrics(): LyricsSnapshot {
  const { lyrics } = useClient();
  return useSyncExternalStore(lyrics.subscribe, lyrics.getSnapshot);
}

export interface RequestState<T> {
  data: T | undefined;
  error: string | null;
}

/** Loads data on mount and whenever `load` changes; memoise `load` with useCallback. */
export function useRequest<T>(load: () => Promise<T>): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ data: undefined, error: null });

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ data, error: null });
      },
      (reason: unknown) => {
        if (active) setState({ data: undefined, error: errorMessage(reason) });
      },
    );
    return () => {
      active = false;
    };
  }, [load]);

  return state;
}

/** The start of today, as a time; it moves on at midnight, and when the window comes back after a sleep. */
export function useToday(): number {
  const [today, setToday] = useState(startOfToday);

  useEffect(() => {
    const check = () => setToday(startOfToday());
    const midnight = new Date(today);
    midnight.setDate(midnight.getDate() + 1);
    const timer = window.setTimeout(check, midnight.getTime() - Date.now());
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", check);
    };
  }, [today]);

  return today;
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
