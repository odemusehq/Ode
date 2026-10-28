import { HistoryView } from "../views/HistoryView";
import { LyricsPanel } from "../views/LyricsPanel";
import { NowPanel } from "../views/NowPanel";
import { AppHeader } from "./AppHeader";
import { useAppState } from "./hooks";
import { StatusBar } from "./StatusBar";

/** The Ode window: the header, the Now panel, then the history, with the lyrics beside it (or over it) when open. */
export function MainLayout() {
  const lyricsOpen = useAppState((state) => state.lyricsOpen);

  return (
    <div className="app">
      <AppHeader />
      <NowPanel />
      <div className="app-body">
        <HistoryView />
        {lyricsOpen && <LyricsPanel />}
      </div>
      <StatusBar />
    </div>
  );
}
