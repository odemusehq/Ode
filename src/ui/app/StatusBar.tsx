import { cx } from "../../ui-kit";
import { CONNECTION_HINTS, CONNECTION_LABELS, SERVER_MESSAGES, isServerLost, missingConnections } from "./connections";
import { useAppState } from "./hooks";

/** Shown at the bottom of the window only when something isn't connected, with what to do about it. */
export function StatusBar() {
  const live = useAppState((state) => state.live);
  const stream = useAppState((state) => state.stream);
  const serverMessage = SERVER_MESSAGES[stream];
  const missing = missingConnections(live);

  if (!serverMessage && missing.length === 0) return null;

  return (
    <footer className="status-bar" role="status">
      {serverMessage ? (
        <p className={cx("status-bar__line", isServerLost(stream) && "status-bar__line--lost")}>{serverMessage}</p>
      ) : (
        missing.map((connection) => (
          <p key={connection} className="status-bar__line">
            <strong>{CONNECTION_LABELS[connection]}:</strong> {CONNECTION_HINTS[connection]}
          </p>
        ))
      )}
    </footer>
  );
}
