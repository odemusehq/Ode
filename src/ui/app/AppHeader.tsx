import { BusyIndicator } from "../../ui-kit";
import { useAppState } from "./hooks";
import { LogoLockup } from "./Logo";

export function AppHeader() {
  const busy = useAppState((state) => state.busy);
  const title = useAppState((state) => state.song?.title ?? "");

  return (
    <header className="app-header">
      <h1 className="app-header__name">
        <LogoLockup />
      </h1>
      <p className="app-header__song" title={title}>
        {title}
      </p>
      <BusyIndicator busy={busy} />
    </header>
  );
}
