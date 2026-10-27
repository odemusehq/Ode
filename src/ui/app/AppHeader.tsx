import { BusyIndicator } from "../../ui-kit";
import { useAppState } from "./hooks";
import { Logo } from "./Logo";

export function AppHeader() {
  const busy = useAppState((state) => state.busy);
  const title = useAppState((state) => state.song?.title ?? "");

  return (
    <header className="app-header">
      <Logo />
      <h1 className="app-header__name">Ode</h1>
      <p className="app-header__song" title={title}>
        {title}
      </p>
      <BusyIndicator busy={busy} />
    </header>
  );
}
