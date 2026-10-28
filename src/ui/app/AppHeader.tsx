import { Button, ButtonVariant } from "../../ui-kit";
import { LYRICS_PANEL_ID } from "../views/LyricsPanel";
import { ModePicker } from "../views/ModePicker";
import { ConnectionDot } from "./ConnectionDot";
import { useAppState, useClient } from "./hooks";
import { LogoLockup } from "./Logo";

/** The logo, the song title, the Lyrics button, the mode picker and the connection dot. */
export function AppHeader() {
  const { store } = useClient();
  const title = useAppState((state) => state.title);
  const lyricsOpen = useAppState((state) => state.lyricsOpen);

  return (
    <header className="app-header">
      <h1 className="app-header__name">
        <LogoLockup />
      </h1>
      <p className="app-header__song" title={title}>
        {title}
      </p>
      <Button
        variant={ButtonVariant.Quiet}
        aria-pressed={lyricsOpen}
        aria-controls={lyricsOpen ? LYRICS_PANEL_ID : undefined}
        onClick={() => store.toggleLyrics()}
      >
        Lyrics
      </Button>
      <ModePicker />
      <ConnectionDot />
    </header>
  );
}
