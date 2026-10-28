import { Button, ButtonVariant, Dot, IconName, Tone, cx, toPlainText } from "../../ui-kit";
import { CONNECTION_HINTS, CONNECTION_LABELS, SERVER_MESSAGES, connectionSummary, missingConnections } from "./connections";
import { useAppState, useClient } from "./hooks";
import { Logo } from "./Logo";

const READY = "Ready";
const WORKING = "Working…";
const NO_RESULT = "Ode's last change shows here.";

/** The strip in Live's device area: the status, the last result line and Undo. */
export function CompactStrip() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const progress = useAppState((state) => state.progress);
  const result = useAppState((state) => state.result);
  const error = useAppState((state) => state.error);
  const stream = useAppState((state) => state.stream);
  const live = useAppState((state) => state.live);
  const serverMessage = SERVER_MESSAGES[stream];
  const connection = connectionSummary(stream, live);
  const missing = missingConnections(live)[0];
  const problem = serverMessage ?? (missing ? `${CONNECTION_LABELS[missing]}: ${CONNECTION_HINTS[missing]}` : null);
  const status = busy ? (progress ?? WORKING) : (error ?? problem ?? READY);
  const failing = !busy && (error !== null || connection.problem);
  const resultText = result ? toPlainText(result.text) : NO_RESULT;

  return (
    <div className="strip">
      <Logo />
      <p className={cx("strip__status", failing && "strip__status--problem")} role="status" title={status}>
        <Dot tone={busy ? Tone.Accent : error ? Tone.Danger : connection.tone} pulse={busy} hollow={!busy && connection.problem} />
        <span className="strip__status-text">{status}</span>
      </p>
      <p className={cx("strip__result", !result && "strip__result--empty")} title={resultText}>
        {resultText}
      </p>
      <div className="strip__actions">
        <Button
          variant={ButtonVariant.Secondary}
          icon={IconName.Undo}
          disabled={busy || serverMessage !== null}
          title="Go back to the version before Ode's last change"
          onClick={() => void client.undo()}
        >
          Undo
        </Button>
      </div>
    </div>
  );
}
