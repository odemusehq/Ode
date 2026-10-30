import { t } from "../../shared/i18n";
import { StreamState } from "./model";

/** What to say about the connection to the Ode server; null while it is open. */
export const SERVER_MESSAGES: Record<StreamState, string | null> = {
  [StreamState.Connecting]: t("connection.connecting"),
  [StreamState.Open]: null,
  [StreamState.Reconnecting]: t("connection.reconnecting"),
  [StreamState.Closed]: t("connection.reconnecting"),
};

export function isServerLost(state: StreamState): boolean {
  return state === StreamState.Reconnecting || state === StreamState.Closed;
}
