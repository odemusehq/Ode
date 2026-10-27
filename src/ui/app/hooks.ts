import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import { errorMessage } from "./api";
import type { OdeClient } from "./client";
import type { AppState } from "./model";

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

export interface RequestState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: Dispatch<SetStateAction<T | undefined>>;
}

/** Loads data on mount and whenever `load` changes; memoise `load` with useCallback. */
export function useRequest<T>(load: () => Promise<T>): RequestState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((value) => {
        if (!active) return;
        setData(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data, error, loading, reload, setData };
}

/** Calls `reload` each time `value` changes after the first render. */
export function useReloadOnChange(value: unknown, reload: () => void): void {
  const initial = useRef(value);
  const changed = useRef(false);

  useEffect(() => {
    if (!changed.current && Object.is(value, initial.current)) return;
    changed.current = true;
    reload();
  }, [value, reload]);
}
