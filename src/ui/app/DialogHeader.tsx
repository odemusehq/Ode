import { ModePicker } from "../views/ModePicker";
import { SongMenu } from "../views/SongMenu";
import { LogoLockup } from "./Logo";
import { Button, ButtonVariant } from "../../ui-kit";
import { useClient } from "./hooks";
import { Layout } from "./layout";

export interface DialogHeaderProps {
  /** Ask Ode shows the mode Ode works in; the other dialogs leave it out. */
  withMode?: boolean;
}

/** The top of every Ode dialog: the logo, the song Ode is working on, and the mode where it matters. */
export function DialogHeader({ withMode = false }: DialogHeaderProps) {
  const client = useClient();
  const navigate = async (view: Layout) => {
    if (!await client.lyrics.flush()) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.location.assign(url.href);
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
          .filter(([view]) => view !== client.layout)
          .map(([view, label]) => <Button key={view} variant={ButtonVariant.Quiet} onClick={() => void navigate(view)}>{label}</Button>)}
      </nav>
    </header>
  );
}
