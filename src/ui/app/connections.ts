import { StreamState } from "./model";

/** What to say about the connection to the Ode server; null while it is open. */
export const SERVER_MESSAGES: Record<StreamState, string | null> = {
  [StreamState.Connecting]: "Connecting to Ode…",
  [StreamState.Open]: null,
  [StreamState.Reconnecting]: "Reconnecting to Ode…",
  [StreamState.Closed]: "Reconnecting to Ode…",
};

export function isServerLost(state: StreamState): boolean {
  return state === StreamState.Reconnecting || state === StreamState.Closed;
}
