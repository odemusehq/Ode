import { Icon, IconName, cx } from "../../ui-kit";
import type { Step } from "../app/model";

interface WorkingStepsProps {
  steps: readonly Step[];
  rationale?: string | null;
  active?: boolean;
}

/** A turn's public activity: current work stays visible; its completed steps expand in place. */
export function WorkingSteps({ steps, rationale, active = false }: WorkingStepsProps) {
  if (!steps.length && !rationale) return null;
  const current = active ? steps.findLast((step) => step.status === "running") : undefined;
  const failed = steps.filter((step) => step.status === "error").length;
  const completed = steps.filter((step) => step.status === "done").length;
  const subjects = [...new Set(steps.flatMap((step) => {
    const separator = step.label.indexOf(" · ");
    return separator > 0 ? [step.label.slice(0, separator)] : [];
  }))];
  const subject = subjects.length > 2 ? `${subjects.slice(0, 2).join(", ")} + ${subjects.length - 2} more` : subjects.join(", ");
  const count = `${steps.length} ${steps.length === 1 ? "step" : "steps"}`;
  const summary = current?.label ?? (steps.length === 1 ? steps[0]!.label : [subject, count].filter(Boolean).join(" · "));
  const statusIcon = active ? IconName.Info : failed > 0 ? IconName.Alert : IconName.Check;
  const shortRationale = rationale && rationale.length > 180 ? `${rationale.slice(0, 177).trimEnd()}…` : rationale;

  return <div className={cx("activity", active && "activity--active")}>
    {steps.length > 0 && <details className="activity__group">
      <summary aria-label={`${active ? "Current activity" : "Activity"}: ${summary}. ${completed} completed${failed ? `, ${failed} failed` : ""}. Expand for steps and purpose.`}>
        <Icon name={statusIcon} />
        <span className="activity__summary">{summary}</span>
        {current && completed > 0 && <span className="activity__count">{completed} done</span>}
        <span className="activity__chevron"><Icon name={IconName.ChevronRight} /></span>
      </summary>
      {rationale && <p className="activity__rationale">{rationale}</p>}
      <ol className="activity__list" aria-label="Musical activity">
        {steps.map((step) => <li key={step.id} className={cx("activity__step", `activity__step--${step.status}`)}>
          <Icon name={step.status === "error" ? IconName.Alert : step.status === "done" ? IconName.Check : IconName.Edit} />
          <span><span className="ode-visually-hidden">{step.status === "running" ? "In progress: " : step.status === "error" ? "Failed: " : "Completed: "}</span>{step.label}
            {step.reason && step.reason !== rationale && <span className="activity__reason">{step.reason}</span>}
          </span>
        </li>)}
      </ol>
    </details>}
    {active && shortRationale && <p className="activity__purpose">{shortRationale}</p>}
  </div>;
}
