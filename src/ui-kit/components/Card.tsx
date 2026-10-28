import { useId } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Tone } from "./types";
import "./Card.css";

export interface CardProps {
  /** A word or two above the line saying what kind of card it is, e.g. "Question". */
  kicker: string;
  tone?: Tone;
  /** The card's one line. */
  children: ReactNode;
  /** The buttons that answer it. */
  actions?: ReactNode;
  /** Shown while the answer is on its way. */
  waiting?: boolean;
}

/** A small card in the flow of the page, never a dialog: one line and the buttons that answer it. */
export function Card({ kicker, tone = Tone.Accent, children, actions, waiting }: CardProps) {
  const kickerId = useId();
  const textId = useId();
  return (
    <section
      className={cx("ode-card", `ode-card--${tone}`, waiting && "ode-card--waiting")}
      aria-labelledby={kickerId}
      aria-describedby={textId}
      aria-busy={waiting || undefined}
    >
      <p id={kickerId} className="ode-card__kicker">
        {kicker}
      </p>
      <div id={textId} className="ode-card__text">
        {children}
      </div>
      {actions && <div className="ode-card__actions">{actions}</div>}
    </section>
  );
}
