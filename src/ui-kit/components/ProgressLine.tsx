import "./ProgressLine.css";

export interface ProgressLineProps {
  text: string;
}

/** One line saying what Ode is doing now, after a pulsing dot. */
export function ProgressLine({ text }: ProgressLineProps) {
  return (
    <div className="ode-progress" title={text}>
      <span className="ode-progress__dot" aria-hidden="true" />
      <span className="ode-progress__text">{text}</span>
    </div>
  );
}
