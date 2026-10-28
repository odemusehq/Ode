import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Button, ButtonVariant } from "./Button";
import "./Card.css";
import "./ConfirmCard.css";

export interface ConfirmCardProps {
  /** The question, e.g. "Go back to 22:38? Later versions will be deleted." */
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Other choices, shown before the confirm button, e.g. "Make a copy first". */
  extra?: ReactNode;
  /** The action is running; the buttons wait for it. */
  busy?: boolean;
}

/** Asks before an action that deletes something. Inline, never a dialog; Escape or Cancel leaves it. */
export function ConfirmCard({ message, confirmLabel, onConfirm, onCancel, extra, busy }: ConfirmCardProps) {
  const messageId = useId();
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || busy) return;
    event.preventDefault();
    onCancel();
  };

  return (
    <div className="ode-card ode-card--danger ode-confirm" role="group" aria-labelledby={messageId} aria-busy={busy || undefined} onKeyDown={handleKeyDown}>
      <div id={messageId} className="ode-card__text ode-confirm__message">
        {message}
      </div>
      <div className="ode-card__actions">
        {extra}
        <Button variant={ButtonVariant.Danger} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
        <Button ref={cancel} onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
