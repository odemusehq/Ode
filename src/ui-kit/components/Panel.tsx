import { useId } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import { cx } from "./cx";
import "./Panel.css";

export interface PanelProps {
  title: string;
  /** Controls shown at the right of the title, e.g. a refresh button. */
  actions?: ReactNode;
  /** Renders as an expandable section, for optional or advanced content. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, actions, collapsible, defaultOpen, onToggle, className, children }: PanelProps) {
  const titleId = useId();

  if (collapsible) {
    const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => onToggle?.(event.currentTarget.open);
    return (
      <details className={cx("ode-panel", "ode-panel--collapsible", className)} open={defaultOpen} onToggle={handleToggle}>
        <summary className="ode-panel__header">
          <h2 className="ode-panel__title">{title}</h2>
          {actions && <div className="ode-panel__actions">{actions}</div>}
        </summary>
        <div className="ode-panel__body">{children}</div>
      </details>
    );
  }

  return (
    <section className={cx("ode-panel", className)} aria-labelledby={titleId}>
      <header className="ode-panel__header">
        <h2 id={titleId} className="ode-panel__title">
          {title}
        </h2>
        {actions && <div className="ode-panel__actions">{actions}</div>}
      </header>
      <div className="ode-panel__body">{children}</div>
    </section>
  );
}
