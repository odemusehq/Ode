import { Dot } from "../../ui-kit";
import { connectionSummary } from "./connections";
import { useAppState } from "./hooks";

/** The connection to Ode and Live as one dot; its label says which parts are connected. */
export function ConnectionDot() {
  const stream = useAppState((state) => state.stream);
  const live = useAppState((state) => state.live);
  const summary = connectionSummary(stream, live);
  return (
    <span className="app-header__connection">
      <Dot tone={summary.tone} hollow={summary.problem} label={summary.label} />
    </span>
  );
}
