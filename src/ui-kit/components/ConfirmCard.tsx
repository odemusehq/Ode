import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Button, ButtonVariant } from "./Button";
import { cx } from "./cx";
import { Tone } from "./types";
import "./Card.css";
import "./ConfirmCard.css";

export interface ConfirmCardProps {
  /** The question, e.g. "Go back to 22:38? The 3 versions after it will be deleted." */
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** Other choices, shown before the confirm button, e.g. "Make a copy first". */
  extra?: ReactNode;
  /** The action is running; the buttons wait for it. */
  busy?: boolean;
  /** Danger when confirming deletes something. */
  tone?: Tone;
}

/** Asks before an action that can't be taken back. Inline, never a dialog; Escape or Cancel leaves it. */
export function ConfirmCard({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  extra,
  busy,
  tone = Tone.Danger,
}: ConfirmCardProps) {
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
    <div
      className={cx("ode-card", `ode-card--${tone}`, "ode-confirm")}
      role="group"
      aria-labelledby={messageId}
      aria-busy={busy || undefined}
      onKeyDown={handleKeyDown}
    >
      <div id={messageId} className="ode-card__text ode-confirm__message">
        {message}
      </div>
      <div className="ode-card__actions">
        {extra}
        <Button variant={tone === Tone.Danger ? ButtonVariant.Danger : ButtonVariant.Primary} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
        <Button ref={cancel} onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
