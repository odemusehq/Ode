import { ModePicker } from "../views/ModePicker";
import { SongMenu } from "../views/SongMenu";
import { LogoLockup } from "./Logo";
import { Button, ButtonVariant } from "../../ui-kit";
import { useAppState, useClient } from "./hooks";
import { Layout } from "./layout";

export interface DialogHeaderProps {
  /** Ask Ode shows the mode Ode works in; the other dialogs leave it out. */
  withMode?: boolean;
}

/** The top of every Ode dialog: the logo, the song Ode is working on, and the mode where it matters. */
export function DialogHeader({ withMode = false }: DialogHeaderProps) {
  const client = useClient();
  const lyricsOpen = useAppState((state) => state.lyricsOpen);
  const workspace = client.layout === Layout.Ask || client.layout === Layout.Lyrics;
  const navigate = async (view: Layout) => {
    await client.navigate(view);
  };
  return (
    <header className="app-header">
      <h1 className="app-header__name">
        <LogoLockup />
      </h1>
      <div className="app-header__song">
        <SongMenu />
      </div>
      {withMode && <ModePicker />}
      <nav className="app-header__nav" aria-label="Ode views">
        {([[Layout.Ask, "Chat"], [Layout.Lyrics, "Lyrics"], [Layout.History, "History"], [Layout.Settings, "Settings"]] as const)
          .filter(([view]) => workspace ? view !== Layout.Ask : view !== client.layout)
          .map(([view, label]) => <Button key={view} variant={ButtonVariant.Quiet}
            aria-pressed={view === Layout.Lyrics && workspace ? lyricsOpen : undefined}
            onClick={() => void navigate(view === Layout.Lyrics && workspace && lyricsOpen ? Layout.Ask : view)}>{label}</Button>)}
      </nav>
    </header>
  );
}
