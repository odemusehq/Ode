import { cx } from "../../ui-kit";
import { SERVER_MESSAGES, isServerLost } from "./connections";
import { useAppState } from "./hooks";

/** Shown at the bottom of a dialog only while the page reaches for Ode. */
export function StatusBar() {
  const stream = useAppState((state) => state.stream);
  const message = SERVER_MESSAGES[stream];
  if (!message) return null;
  return (
    <footer className="status-bar" role="status">
      <p className={cx("status-bar__line", isServerLost(stream) && "status-bar__line--lost")}>{message}</p>
    </footer>
  );
}
