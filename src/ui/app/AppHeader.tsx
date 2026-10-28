import { ModePicker } from "../views/ModePicker";
import { ConnectionDot } from "./ConnectionDot";
import { useAppState } from "./hooks";
import { LogoLockup } from "./Logo";

/** The logo, the song title, the mode picker and the connection dot. */
export function AppHeader() {
  const title = useAppState((state) => state.song?.title ?? "");

  return (
    <header className="app-header">
      <h1 className="app-header__name">
        <LogoLockup />
      </h1>
      <p className="app-header__song" title={title}>
        {title}
      </p>
      <ModePicker />
      <ConnectionDot />
    </header>
  );
}
