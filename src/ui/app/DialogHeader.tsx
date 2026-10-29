import { ModePicker } from "../views/ModePicker";
import { SongMenu } from "../views/SongMenu";
import { LogoLockup } from "./Logo";

export interface DialogHeaderProps {
  /** Ask Ode shows the mode Ode works in; the other dialogs leave it out. */
  withMode?: boolean;
}

/** The top of every Ode dialog: the logo, the song Ode is working on, and the mode where it matters. */
export function DialogHeader({ withMode = false }: DialogHeaderProps) {
  return (
    <header className="app-header">
      <h1 className="app-header__name">
        <LogoLockup />
      </h1>
      <div className="app-header__song">
        <SongMenu />
      </div>
      {withMode && <ModePicker />}
    </header>
  );
}
