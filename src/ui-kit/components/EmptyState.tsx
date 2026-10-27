import type { ReactNode } from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  title: string;
  /** What to do to fill this space. */
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="ode-empty">
      <p className="ode-empty__title">{title}</p>
      {children && <div className="ode-empty__body">{children}</div>}
      {action && <div className="ode-empty__action">{action}</div>}
    </div>
  );
}
