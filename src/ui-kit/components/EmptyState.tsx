import "./EmptyState.css";

export interface EmptyStateProps {
  title: string;
}

/** A quiet line where a list is still empty. */
export function EmptyState({ title }: EmptyStateProps) {
  return <p className="ode-empty">{title}</p>;
}
