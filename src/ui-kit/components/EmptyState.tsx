import "./EmptyState.css";

export interface EmptyStateProps {
  title: string;
}

/** A quiet line where a list has nothing in it yet. */
export function EmptyState({ title }: EmptyStateProps) {
  return <p className="ode-empty">{title}</p>;
}
