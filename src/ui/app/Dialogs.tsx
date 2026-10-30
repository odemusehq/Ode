import { Notice, Tone } from "../../ui-kit";
import { HistoryView } from "../views/HistoryView";
import { LyricsPanel } from "../views/LyricsPanel";
import { NowPanel } from "../views/NowPanel";
import { DialogHeader } from "./DialogHeader";
import { useAppState } from "./hooks";
import { StatusBar } from "./StatusBar";

/** The persistent conversation and Ode's work in the open Set. */
export function AskDialog() {
  const lyricsOpen = useAppState((state) => state.lyricsOpen);
  const [lyricsSeen, setLyricsSeen] = useState(lyricsOpen);
  useEffect(() => { if (lyricsOpen) setLyricsSeen(true); }, [lyricsOpen]);
  return (
    <div className={lyricsOpen ? "app app--lyrics" : "app"}>
      <DialogHeader withMode />
      <div className="app-body">
        <NowPanel />
        <div className="app-lyrics" hidden={!lyricsOpen}>
          {(lyricsOpen || lyricsSeen) && <LyricsPanel />}
        </div>
      </div>
      <DialogFooter />
      <StatusBar />
    </div>
  );
}

/** Ode: Lyrics, the song's lyrics that the musician and Ode both edit. */
export function LyricsDialog() {
  return <AskDialog />;
}

/** Ode: History, the song's versions, to look back through and restore. */
export function HistoryDialog() {
  return (
    <div className="app">
      <DialogHeader />
      <div className="app-body">
        <HistoryView />
      </div>
      <DialogFooter showsErrors />
      <StatusBar />
    </div>
  );
}

/** Required model credit and view errors appear only when present. */
function DialogFooter({ showsErrors = false }: { showsErrors?: boolean }) {
  const credit = useAppState((state) => state.credit);
  const error = useAppState((state) => state.error);
  if (!credit && !(showsErrors && error)) return null;
  return (
    <footer className="app-footer">
      {showsErrors && error && <Notice tone={Tone.Danger}>{error}</Notice>}
      {credit && <p className="app-footer__credit">{credit}</p>}
    </footer>
  );
}
import { useEffect, useState } from "react";
