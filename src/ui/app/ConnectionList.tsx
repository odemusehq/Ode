import type { LiveStatus } from "../../shared/live";
import { cx } from "../../ui-kit";
import { CONNECTION_LABELS, LIVE_CONNECTIONS, isConnected } from "./connections";

export interface ConnectionListProps {
  /** Null until the first status arrives. */
  status: LiveStatus | null;
}

/** The three Live connections with a status dot each. */
export function ConnectionList({ status }: ConnectionListProps) {
  return (
    <ul className="connections" aria-label="Live connections">
      {LIVE_CONNECTIONS.map((connection) => {
        const connected = status ? isConnected(status, connection) : null;
        const state = connected === null ? "checking" : connected ? "connected" : "not connected";
        return (
          <li key={connection} className="connections__item" title={`${CONNECTION_LABELS[connection]}: ${state}`}>
            <span
              className={cx("connections__dot", connected === true && "connections__dot--on", connected === false && "connections__dot--off")}
              aria-hidden="true"
            />
            {CONNECTION_LABELS[connection]}
            <span className="ode-visually-hidden">: {state}</span>
          </li>
        );
      })}
    </ul>
  );
}
