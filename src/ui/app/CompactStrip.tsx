import type { LiveStatus } from "../../shared/live";
import { Dot, Tone, cx, toPlainText } from "../../ui-kit";
import { CONNECTION_HINTS, CONNECTION_LABELS, SERVER_MESSAGES, connectionSummary, missingConnections } from "./connections";
import { useAppState } from "./hooks";
import { Logo } from "./Logo";
import type { AppState, StreamState } from "./model";

const READY = "Ready";
const WORKING = "Working…";
const WAITING_FOR_YOU = "Waiting for you · open the Ode window";

interface StripStatus {
  text: string;
  tone: Tone;
  /** Ode is working. */
  pulse: boolean;
  /** Something is missing or lost. */
  hollow: boolean;
}

/** The strip in Live's device area: the status and Ode's last result line. Undo and Again are the device's own controls. */
export function CompactStrip() {
  const busy = useAppState((state) => state.busy);
  const progress = useAppState((state) => state.progress);
  const result = useAppState((state) => state.result);
  const error = useAppState((state) => state.error);
  const stream = useAppState((state) => state.stream);
  const live = useAppState((state) => state.live);
  const waiting = useAppState((state) => state.questions.length > 0 || state.approvals.length > 0);
  const status = stripStatus(stream, live, waiting, busy, progress, error);
  const resultText = result ? toPlainText(result.text) : "";

  return (
    <div className="strip">
      <Logo />
      <p className={cx("strip__status", (status.tone === Tone.Danger || status.hollow) && "strip__status--problem")} role="status" title={status.text}>
        <Dot tone={status.tone} pulse={status.pulse} hollow={status.hollow} />
        <span className="strip__status-text">{status.text}</span>
      </p>
      {resultText && (
        <p className="strip__result" title={resultText}>
          {resultText}
        </p>
      )}
    </div>
  );
}

/** What the strip says first: a lost connection to Ode, then a question or change waiting, then the work, an error, Live. */
function stripStatus(stream: StreamState, live: LiveStatus | null, waiting: boolean, busy: boolean, progress: AppState["progress"], error: AppState["error"]): StripStatus {
  const connection = connectionSummary(stream, live);
  const serverMessage = SERVER_MESSAGES[stream];
  if (serverMessage) return { text: serverMessage, tone: connection.tone, pulse: false, hollow: connection.problem };
  if (waiting) return { text: WAITING_FOR_YOU, tone: Tone.Info, pulse: false, hollow: false };
  if (busy) return { text: progress ?? WORKING, tone: Tone.Accent, pulse: true, hollow: false };
  if (error) return { text: error, tone: Tone.Danger, pulse: false, hollow: false };
  const missing = missingConnections(live)[0];
  if (missing) return { text: `${CONNECTION_LABELS[missing]}: ${CONNECTION_HINTS[missing]}`, tone: connection.tone, pulse: false, hollow: true };
  return { text: READY, tone: connection.tone, pulse: false, hollow: false };
}
