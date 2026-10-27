import { useId } from "react";
import { Badge } from "./Badge";
import { Button, ButtonGroup, ButtonVariant } from "./Button";
import { cx } from "./cx";
import { Tone } from "./types";
import "./ApprovalCard.css";

export enum ApprovalStatus {
  Pending = "pending",
  Allowed = "allowed",
  AlwaysAllowed = "always-allowed",
  Denied = "denied",
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.Pending]: "Waiting for approval",
  [ApprovalStatus.Allowed]: "Allowed",
  [ApprovalStatus.AlwaysAllowed]: "Always allowed",
  [ApprovalStatus.Denied]: "Denied",
};

const STATUS_TONES: Record<ApprovalStatus, Tone> = {
  [ApprovalStatus.Pending]: Tone.Accent,
  [ApprovalStatus.Allowed]: Tone.Success,
  [ApprovalStatus.AlwaysAllowed]: Tone.Success,
  [ApprovalStatus.Denied]: Tone.Danger,
};

export interface ApprovalCardProps {
  /** Name of the tool that wants to make the change. */
  tool: string;
  /** What the change does, in plain words. */
  summary: string;
  /** The tool's input, shown under Details. */
  input?: unknown;
  status: ApprovalStatus;
  onAllow: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
}

/** A change Ode wants to make, with the musician's decision. */
export function ApprovalCard({ tool, summary, input, status, onAllow, onDeny, onAlwaysAllow }: ApprovalCardProps) {
  const summaryId = useId();
  const pending = status === ApprovalStatus.Pending;
  return (
    <article className={cx("ode-approval", pending && "ode-approval--pending")} aria-labelledby={summaryId}>
      <header className="ode-approval__header">
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
        <code className="ode-approval__tool">{tool}</code>
      </header>
      <p id={summaryId} className="ode-approval__summary">
        {summary}
      </p>
      {input !== undefined && input !== null && (
        <details className="ode-approval__details">
          <summary>Details</summary>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </details>
      )}
      <div className="ode-approval__actions">
        <ButtonGroup label="Decision">
          <Button variant={ButtonVariant.Primary} onClick={onAllow} disabled={!pending}>
            Allow
          </Button>
          <Button onClick={onDeny} disabled={!pending}>
            Deny
          </Button>
        </ButtonGroup>
        <Button
          variant={ButtonVariant.Quiet}
          onClick={onAlwaysAllow}
          disabled={!pending}
          title={`Allow ${tool} from now on without asking`}
          className="ode-approval__always"
        >
          Always allow this kind of change
        </Button>
      </div>
    </article>
  );
}
