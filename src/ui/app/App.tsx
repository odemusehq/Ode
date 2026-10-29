import { useEffect } from "react";
import { SettingsView } from "../views/SettingsView";
import { AskDialog, HistoryDialog, LyricsDialog } from "./Dialogs";
import { useClient } from "./hooks";
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
  const { layout } = useClient();
  useEffect(() => {
    document.title = TITLES[layout];
  }, [layout]);
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
