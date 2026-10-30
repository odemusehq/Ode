import { Button, ButtonVariant, Notice, Tone } from "../../ui-kit";
import { HistoryView } from "../views/HistoryView";
import { LyricsPanel } from "../views/LyricsPanel";
import { NowPanel } from "../views/NowPanel";
import { DialogHeader } from "./DialogHeader";
import { LiveDialog } from "./dialog";
import { useAppState, useClient } from "./hooks";
import { StatusBar } from "./StatusBar";

/** Ask Ode: what the musician pointed at, the request, Ode's work as it goes, the result, and Close back to Live. */
export function AskDialog() {
  return (
    <div className="app">
      <DialogHeader withMode />
      <div className="app-body">
        <NowPanel />
      </div>
      <DialogFooter />
      <StatusBar />
    </div>
  );
}

/** Ode: Lyrics, the song's lyrics that the musician and Ode both edit. */
export function LyricsDialog() {
  return (
    <div className="app">
      <DialogHeader />
      <div className="app-body">
        <LyricsPanel />
      </div>
      <DialogFooter showsErrors />
      <StatusBar />
    </div>
  );
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

/**
 * The model's credit where its licence asks for one, and Close back to Live; while Ode works Close waits, since Live
 * waits behind the dialog for Ode too. Lyrics and History show here why a song switch went wrong (Ask Ode shows it
 * under its result line).
 */
function DialogFooter({ showsErrors = false }: { showsErrors?: boolean }) {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const credit = useAppState((state) => state.credit);
  const error = useAppState((state) => state.error);
  return (
    <footer className="app-footer">
      {showsErrors && error && <Notice tone={Tone.Danger}>{error}</Notice>}
      {credit && <p className="app-footer__credit">{credit}</p>}
      {LiveDialog.hosted && (
        <Button variant={ButtonVariant.Secondary} disabled={busy && LiveDialog.modal} onClick={() => void client.close()}>
          Close
        </Button>
      )}
    </footer>
  );
}
