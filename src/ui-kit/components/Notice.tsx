import type { ReactNode } from "react";
import { Icon, IconName } from "./Icon";
import { Tone } from "./types";
import "./Notice.css";

export interface NoticeProps {
  tone?: Tone;
  children: ReactNode;
}

/** A short inline message; errors are announced straight away. */
export function Notice({ tone = Tone.Info, children }: NoticeProps) {
  const urgent = tone === Tone.Danger || tone === Tone.Warning;
  return (
    <div className={`ode-notice ode-notice--${tone}`} role={urgent ? "alert" : "status"}>
      <Icon name={urgent ? IconName.Alert : IconName.Info} />
      <div className="ode-notice__text">{children}</div>
    </div>
  );
}
