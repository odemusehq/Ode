import { cx } from "../../ui-kit";
import { CONNECTION_HINTS, CONNECTION_LABELS, SERVER_MESSAGES, isServerLost, missingConnections } from "./connections";
import { ConnectionList } from "./ConnectionList";
import { useAppState } from "./hooks";

/** Shown at the bottom of the window only when something isn't connected, with what to do about it. */
export function StatusBar() {
  const live = useAppState((state) => state.live);
  const stream = useAppState((state) => state.stream);
  const serverMessage = SERVER_MESSAGES[stream];
  const missing = missingConnections(live);

  if (!serverMessage && missing.length === 0) return null;

  return (
    <footer className="status-bar">
      {serverMessage && (
        <p className={cx("status-bar__server", isServerLost(stream) && "status-bar__server--lost")} role="status">
          {serverMessage}
        </p>
      )}
      {missing.length > 0 && (
        <>
          <ConnectionList status={live} />
          <ul className="status-bar__hints">
            {missing.map((connection) => (
              <li key={connection}>
                <strong>{CONNECTION_LABELS[connection]}:</strong> {CONNECTION_HINTS[connection]}
              </li>
            ))}
          </ul>
        </>
      )}
    </footer>
  );
}
