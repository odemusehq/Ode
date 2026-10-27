import { cx } from "./cx";
import "./BusyIndicator.css";

export interface BusyIndicatorProps {
  busy: boolean;
  busyLabel?: string;
  idleLabel?: string;
}

/** Shows whether Ode is working on a request; changes are announced politely. */
export function BusyIndicator({ busy, busyLabel = "Working…", idleLabel = "Ready" }: BusyIndicatorProps) {
  return (
    <span className={cx("ode-busy", busy && "ode-busy--active")} role="status">
      <span className="ode-busy__dot" aria-hidden="true" />
      {busy ? busyLabel : idleLabel}
    </span>
  );
}
