import type { ReactNode } from "react";
import "./Icon.css";

export enum IconName {
  Send = "send",
  Stop = "stop",
  Plus = "plus",
  Minus = "minus",
  Close = "close",
  Trash = "trash",
  Lock = "lock",
  Unlock = "unlock",
  Refresh = "refresh",
  ZoomIn = "zoom-in",
  ZoomOut = "zoom-out",
  Check = "check",
  Alert = "alert",
  Info = "info",
}

export interface IconProps {
  name: IconName;
}

export function Icon({ name }: IconProps) {
  return (
    <svg className="ode-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {iconShape(name)}
    </svg>
  );
}

function iconShape(name: IconName): ReactNode {
  switch (name) {
    case IconName.Send:
      return <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />;
    case IconName.Stop:
      return <rect className="ode-icon__fill" x="4" y="4" width="8" height="8" rx="1" />;
    case IconName.Plus:
      return <path d="M8 3v10M3 8h10" />;
    case IconName.Minus:
      return <path d="M3 8h10" />;
    case IconName.Close:
      return <path d="m4 4 8 8m0-8-8 8" />;
    case IconName.Trash:
      return <path d="M3 4.5h10M6.5 4.5V3h3v1.5m-5 0 .6 8.5h5.8l.6-8.5" />;
    case IconName.Lock:
      return <path d="M4 7.5h8v6H4zM5.75 7.5V5.25a2.25 2.25 0 0 1 4.5 0V7.5" />;
    case IconName.Unlock:
      return <path d="M4 7.5h8v6H4zM5.75 7.5V5.25a2.25 2.25 0 0 1 4.4-.7" />;
    case IconName.Refresh:
      return <path d="M13 8a5 5 0 1 1-1.46-3.54M13 3v3h-3" />;
    case IconName.ZoomIn:
      return <path d="M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.25 10.25 14 14M7 5v4M5 7h4" />;
    case IconName.ZoomOut:
      return <path d="M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.25 10.25 14 14M5 7h4" />;
    case IconName.Check:
      return <path d="m3.5 8.5 3 3 6-7" />;
    case IconName.Alert:
      return <path d="M8 2.5 14 13.5H2zM8 6.5v3M8 11.5v.25" />;
    case IconName.Info:
      return <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7.5v3.5M8 5v.25" />;
  }
}
