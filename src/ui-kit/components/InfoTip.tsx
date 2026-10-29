import { Icon, IconName } from "./Icon";
import "./InfoTip.css";

export interface InfoTipProps {
  /** What the (i) explains, shown on hover and on keyboard focus. */
  text: string;
}

/** A small (i) whose explanation appears on hover and on keyboard focus. */
export function InfoTip({ text }: InfoTipProps) {
  return (
    <span className="ode-info" tabIndex={0} role="img" aria-label={text}>
      <Icon name={IconName.Info} />
      <span className="ode-info__bubble" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
