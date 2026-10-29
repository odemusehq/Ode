import { useEffect } from "react";
import { SettingsView } from "../views/SettingsView";
import { AskDialog, HistoryDialog, LyricsDialog } from "./Dialogs";
import { LiveDialog } from "./dialog";
import { useAppState, useClient } from "./hooks";
import { Layout } from "./layout";
import "./App.css";

/** Each dialog's name, as its window shows it. */
const TITLES: Record<Layout, string> = {
  [Layout.Ask]: "Ask Ode",
  [Layout.Lyrics]: "Ode: Lyrics",
  [Layout.History]: "Ode: History",
  [Layout.Settings]: "Ode: Settings",
};

export function App() {
  const client = useClient();
  const { layout } = client;
  const busy = useAppState((state) => state.busy);
  useEffect(() => {
    document.title = TITLES[layout];
  }, [layout]);
  // Escape closes the dialog like its Close or Cancel button, once a menu, a confirmation or a name field has had its turn.
  useEffect(() => {
    if (!LiveDialog.hosted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !busy) void client.close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [client, busy]);
  switch (layout) {
    case Layout.Lyrics:
      return <LyricsDialog />;
    case Layout.History:
      return <HistoryDialog />;
    case Layout.Settings:
      return <SettingsView />;
    default:
      return <AskDialog />;
  }
}
