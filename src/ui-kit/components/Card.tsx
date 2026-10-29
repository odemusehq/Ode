import { useId } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Tone } from "./types";
import "./Card.css";

export interface CardProps {
  tone?: Tone;
  /** The card's one line. */
  children: ReactNode;
  /** The buttons that answer it. */
  actions?: ReactNode;
  /** Shown while the answer is on its way. */
  waiting?: boolean;
}

/** A small card, always inline in the flow of the page: one line and the buttons that answer it. */
export function Card({ tone = Tone.Accent, children, actions, waiting }: CardProps) {
  const textId = useId();
  return (
    <section
      className={cx("ode-card", `ode-card--${tone}`, waiting && "ode-card--waiting")}
      aria-labelledby={textId}
      aria-busy={waiting || undefined}
    >
      <div id={textId} className="ode-card__text">
        {children}
      </div>
      {actions && <div className="ode-card__actions">{actions}</div>}
    </section>
  );
}
