import type { LiveStatus } from "../../shared/live";
import { StreamState } from "./model";

/** What to say about the connection to the Ode server; null while it is open. */
export const SERVER_MESSAGES: Record<StreamState, string | null> = {
  [StreamState.Connecting]: "Connecting to Ode…",
  [StreamState.Open]: null,
  [StreamState.Reconnecting]: "Can't reach Ode. Reconnecting…",
  [StreamState.Closed]: "Can't reach Ode. Reconnecting…",
};

export function isServerLost(state: StreamState): boolean {
  return state === StreamState.Reconnecting || state === StreamState.Closed;
}

/** The three parts of Ode that connect to Live. */
export enum LiveConnection {
  Extension = "extension",
  Device = "device",
  Bridge = "bridge",
}

export const LIVE_CONNECTIONS: readonly LiveConnection[] = [LiveConnection.Extension, LiveConnection.Device, LiveConnection.Bridge];

export const CONNECTION_LABELS: Record<LiveConnection, string> = {
  [LiveConnection.Extension]: "Extension",
  [LiveConnection.Device]: "Ode device",
  [LiveConnection.Bridge]: "Bridge",
};

/** What the musician does to connect each part. */
export const CONNECTION_HINTS: Record<LiveConnection, string> = {
  [LiveConnection.Extension]: "Open the Live beta with Developer Mode on",
  [LiveConnection.Device]: "Put the Ode device on the Master track",
  [LiveConnection.Bridge]: "Select Ode as a Control Surface in Live's settings",
};

export function isConnected(status: LiveStatus, connection: LiveConnection): boolean {
  switch (connection) {
    case LiveConnection.Extension:
      return status.extension;
    case LiveConnection.Device:
      return status.device;
    case LiveConnection.Bridge:
      return status.bridge;
  }
}
