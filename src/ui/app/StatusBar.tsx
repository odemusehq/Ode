import { cx } from "../../ui-kit";
import { CONNECTION_HINTS, CONNECTION_LABELS, LIVE_CONNECTIONS, SERVER_MESSAGES, isConnected, isServerLost } from "./connections";
import { ConnectionList } from "./ConnectionList";
import { useAppState } from "./hooks";

/** Connection status at the bottom of the window, with what to do when a part is missing. */
export function StatusBar() {
  const live = useAppState((state) => state.live);
  const stream = useAppState((state) => state.stream);
  const serverMessage = SERVER_MESSAGES[stream];
  const missing = live ? LIVE_CONNECTIONS.filter((connection) => !isConnected(live, connection)) : [];

  return (
    <footer className="status-bar">
      {serverMessage && (
        <p className={cx("status-bar__server", isServerLost(stream) && "status-bar__server--lost")} role="status">
          {serverMessage}
        </p>
      )}
      <ConnectionList status={live} />
      {missing.length > 0 && (
        <ul className="status-bar__hints">
          {missing.map((connection) => (
            <li key={connection}>
              <strong>{CONNECTION_LABELS[connection]}:</strong> {CONNECTION_HINTS[connection]}
            </li>
          ))}
        </ul>
      )}
    </footer>
  );
}
