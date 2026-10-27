import { Icon, IconName } from "./Icon";
import "./ActivityLine.css";

export enum ActivityStatus {
  Running = "running",
  Done = "done",
  Failed = "failed",
}

const STATUS_TEXT: Record<ActivityStatus, string> = {
  [ActivityStatus.Running]: "running",
  [ActivityStatus.Done]: "done",
  [ActivityStatus.Failed]: "failed",
};

export interface ActivityLineProps {
  status: ActivityStatus;
  text: string;
}

/** One line of background activity, such as a tool call or a subagent's task. */
export function ActivityLine({ status, text }: ActivityLineProps) {
  return (
    <div className={`ode-activity ode-activity--${status}`} title={text}>
      {status === ActivityStatus.Running && <span className="ode-activity__dot" aria-hidden="true" />}
      {status === ActivityStatus.Done && <Icon name={IconName.Check} />}
      {status === ActivityStatus.Failed && <Icon name={IconName.Alert} />}
      <span className="ode-activity__text">{text}</span>
      <span className="ode-visually-hidden">, {STATUS_TEXT[status]}</span>
    </div>
  );
}
