import type { LiveStatus } from "../../shared/live";
import { Tone } from "../../ui-kit";
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
  [LiveConnection.Device]: "Put the Ode device on the Main track",
  [LiveConnection.Bridge]: "Select Ode as a Control Surface in Live's settings",
};

/** Without the extension Ode can't read or change the Set; the other parts only limit what it can do. */
const ESSENTIAL: ReadonlySet<LiveConnection> = new Set([LiveConnection.Extension]);

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

export function missingConnections(status: LiveStatus | null): LiveConnection[] {
  return status ? LIVE_CONNECTIONS.filter((connection) => !isConnected(status, connection)) : [];
}

export interface ConnectionSummary {
  tone: Tone;
  /** In words, for the dot's tooltip and assistive technology. */
  label: string;
  /** Something is missing or lost. */
  problem: boolean;
}

/** The server and the three Live parts as one status. */
export function connectionSummary(stream: StreamState, status: LiveStatus | null): ConnectionSummary {
  const serverMessage = SERVER_MESSAGES[stream];
  if (serverMessage) return { tone: isServerLost(stream) ? Tone.Danger : Tone.Neutral, label: serverMessage, problem: isServerLost(stream) };
  if (!status) return { tone: Tone.Neutral, label: "Checking the connection to Live…", problem: false };
  const parts = LIVE_CONNECTIONS.map((connection) => `${CONNECTION_LABELS[connection]} ${isConnected(status, connection) ? "connected" : "not connected"}`);
  const missing = missingConnections(status);
  if (missing.length === 0) return { tone: Tone.Success, label: `Connected to Live: ${parts.join(", ")}`, problem: false };
  const essential = missing.some((connection) => ESSENTIAL.has(connection));
  return { tone: essential ? Tone.Danger : Tone.Warning, label: parts.join(", "), problem: true };
}
