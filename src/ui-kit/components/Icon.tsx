import type { ReactNode } from "react";
import "./Icon.css";

export enum IconName {
  Stop = "stop",
  Close = "close",
  Check = "check",
  Alert = "alert",
  Info = "info",
  Microphone = "microphone",
  Note = "note",
  Undo = "undo",
  Again = "again",
  Help = "help",
  More = "more",
  ChevronDown = "chevron-down",
  ChevronRight = "chevron-right",
  Copy = "copy",
  Edit = "edit",
  Restore = "restore",
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
    case IconName.Stop:
      return <rect className="ode-icon__fill" x="4" y="4" width="8" height="8" rx="1" />;
    case IconName.Close:
      return <path d="m4 4 8 8m0-8-8 8" />;
    case IconName.Check:
      return <path d="m3.5 8.5 3 3 6-7" />;
    case IconName.Alert:
      return <path d="M8 2.5 14 13.5H2zM8 6.5v3M8 11.5v.25" />;
    case IconName.Info:
      return <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7.5v3.5M8 5v.25" />;
    case IconName.Microphone:
      return <path d="M8 2.25a2 2 0 0 1 2 2V8a2 2 0 0 1-4 0V4.25a2 2 0 0 1 2-2zM4.25 7.75a3.75 3.75 0 0 0 7.5 0M8 11.5v2.25" />;
    case IconName.Note:
      return <path d="M6 12.25a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0zm0 0V4l7-1.5v8.25m0 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0z" />;
    case IconName.Undo:
      return <path d="M5 3.5 2 6.5l3 3M2 6.5h7.5a3.5 3.5 0 0 1 0 7H7" />;
    case IconName.Again:
      return <path d="M2.5 7.5v-1A2.5 2.5 0 0 1 5 4h7.5M10.5 2l2 2-2 2M13.5 8.5v1A2.5 2.5 0 0 1 11 12H3.5M5.5 14l-2-2 2-2" />;
    case IconName.Help:
      return <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM6.25 6.25a1.75 1.75 0 1 1 2.6 1.53c-.5.28-.85.65-.85 1.22v.5M8 11.25v.25" />;
    case IconName.More:
      return (
        <g className="ode-icon__fill">
          <circle cx="3.5" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12.5" cy="8" r="1.25" />
        </g>
      );
    case IconName.ChevronDown:
      return <path d="m4 6 4 4 4-4" />;
    case IconName.ChevronRight:
      return <path d="m6 4 4 4-4 4" />;
    case IconName.Copy:
      return <path d="M6 6h7v7.5H6zM3.5 10.5V2.5h7" />;
    case IconName.Edit:
      return <path d="M10.5 2.75 13.25 5.5 6 12.75H3.25V10zM9 4.25 11.75 7" />;
    case IconName.Restore:
      return <path d="M2.75 8a5.25 5.25 0 1 0 1.54-3.71M2.75 2.75v3h3M8 5.25V8.5l2 1.25" />;
  }
}
