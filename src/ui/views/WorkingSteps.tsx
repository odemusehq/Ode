import { Icon, IconName, cx } from "../../ui-kit";
import { useAppState } from "../app/hooks";
import type { Step } from "../app/model";

const STEP_ICONS: Record<Step["status"], IconName | null> = {
  running: null,
  done: IconName.Check,
  error: IconName.Alert,
};

/** Ode's work as it goes: its note about the next step while it works, then each step it took, in order. */
export function WorkingSteps() {
  const busy = useAppState((state) => state.busy);
  const thought = useAppState((state) => state.thought);
  const steps = useAppState((state) => state.steps);
  if (steps.length === 0 && !(busy && thought)) return null;

  return (
    <div className="steps">
      {busy && thought && <p className="steps__thought">{thought}</p>}
      {steps.length > 0 && (
        <ol className="steps__list" aria-label="Steps">
          {steps.map((step) => {
            const icon = STEP_ICONS[step.status];
            return (
              <li key={step.id} className={cx("steps__item", `steps__item--${step.status}`)}>
                {icon ? <Icon name={icon} /> : <span className="steps__running" aria-hidden="true" />}
                <span className="steps__label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
