import { t } from "../../shared/i18n";
import { Icon, IconName, cx } from "../../ui-kit";
import type { Step } from "../app/model";

interface WorkingStepsProps {
  steps: readonly Step[];
  rationale?: string | null;
  progress?: string | null;
  active?: boolean;
  waiting?: boolean;
}

/** A turn's public activity: current work stays visible; its completed steps expand in place. */
export function WorkingSteps({ steps, rationale, progress, active = false, waiting = false }: WorkingStepsProps) {
  if (!active && !steps.length && !rationale) return null;
  const running = steps.filter((step) => step.status === "running");
  const failed = steps.filter((step) => step.status === "error").length;
  const completed = steps.filter((step) => step.status === "done").length;
  const subjects = [...new Set(steps.flatMap((step) => {
    const separator = step.label.indexOf(" · ");
    return separator > 0 ? [step.label.slice(0, separator)] : [];
  }))];
  const subject = subjects.length > 2 ? t("activity.moreSubjects", { subjects: (subjects.slice(0, 2).join(", ")), count: (subjects.length - 2) }) : subjects.join(", ");
  const count = t("activity.stepCount", { count: (steps.length) });
  const summary = active
    ? [completed ? t("activity.doneCount", { count: (completed) }) : steps.length ? count : t("activity.title"), failed ? t("activity.failedCount", { count: (failed) }) : null].filter(Boolean).join(" · ")
    : steps.length === 1 ? steps[0]!.label : [subject, steps.length ? count : t("activity.title")].filter(Boolean).join(" · ");
  const statusIcon = failed > 0 ? IconName.Alert : running.length > 0 ? IconName.Info : IconName.Check;

  return <div className={cx("activity", active && "activity--active")}>
    {active && <div className="activity__live" role="status">
      {waiting || running.length === 0
        ? <p className="activity__running"><span className={cx("activity__pulse", waiting && "activity__pulse--waiting")} aria-hidden="true" />
          <span>{waiting ? t("activity.waiting") : progress || t("activity.working")}</span></p>
        : running.map((step) => <p className="activity__running" key={step.id}>
          <span className="activity__pulse" aria-hidden="true" /><span>{step.label}</span>
        </p>)}
      {!waiting && running.length > 0 && progress && progress !== rationale && !running.some((step) => step.label === progress) &&
        <p className="activity__purpose">{progress}</p>}
      {rationale && <p className="activity__purpose">{rationale}</p>}
    </div>}
    {/* Keep this disclosure mounted and uncontrolled across activity updates and completion. */}
    <details className="activity__group" hidden={!steps.length && !rationale}>
      <summary aria-label={t("activity.summaryLabel", { summary: (summary), completed: (completed), hasFailed: Boolean((failed)), failed: (failed) })}>
        <Icon name={statusIcon} />
        <span className="activity__summary">{summary}</span>
        <span className="activity__chevron"><Icon name={IconName.ChevronRight} /></span>
      </summary>
      {rationale && <p className="activity__rationale">{rationale}</p>}
      <ol className="activity__list" aria-label={t("activity.listLabel")}>
        {steps.map((step) => <li key={step.id} className={cx("activity__step", `activity__step--${step.status}`)}>
          <Icon name={step.status === "error" ? IconName.Alert : step.status === "done" ? IconName.Check : IconName.Edit} />
          <span><span className="ode-visually-hidden">{t(`activity.stepStatus.${step.status}`)}</span>{step.label}
            {step.reason && step.reason !== rationale && <span className="activity__reason">{step.reason}</span>}
          </span>
        </li>)}
      </ol>
    </details>
  </div>;
}
