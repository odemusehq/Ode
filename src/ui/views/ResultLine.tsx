import { ResultKind } from "../../shared/events";
import { Button, ButtonVariant, Icon, IconButton, IconName, ProgressLine, toPlainText } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import type { ResultLine as Result, WhyAnswer } from "../app/model";

const WORKING = "Working…";

/**
 * While Ode works: one line of progress, with Stop when Stop can interrupt it. Then one line saying what changed,
 * with Undo, Again and Why? for that change, and the short answer to Why? under it. A failure is one line too.
 */
export function ResultLine() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const stoppable = useAppState((state) => state.stoppable);
  const progress = useAppState((state) => state.progress);
  const result = useAppState((state) => state.result);
  const answer = useAppState((state) => state.answer);
  const error = useAppState((state) => state.error);

  return (
    <div className="now__status">
      <div className="now__live" role="status">
        {busy ? (
          <div className="now__progress">
            <ProgressLine text={progress ?? WORKING} />
            {stoppable && (
              <Button icon={IconName.Stop} onClick={() => void client.stopRequest()}>
                Stop
              </Button>
            )}
          </div>
        ) : (
          result && <LastResult result={result} answer={answer} />
        )}
      </div>
      {error && (
        <div className="now__error" role="alert">
          <Icon name={IconName.Alert} />
          <p className="now__error-text">{error}</p>
          <IconButton icon={IconName.Close} label="Dismiss" onClick={() => client.store.setError(null)} />
        </div>
      )}
    </div>
  );
}

interface LastResultProps {
  result: Result;
  answer: WhyAnswer | null;
}

/**
 * Undo goes back from a change, or from what Ode changed before it was stopped; Again and Why? are for a change.
 * Once the musician has changed the Set since, they are out of date.
 */
function LastResult({ result, answer }: LastResultProps) {
  const client = useClient();
  const versionId = result.overtaken ? null : result.versionId;
  const changed = result.kind === ResultKind.Change;
  const canUndo = versionId !== null && (changed || result.kind === ResultKind.Stopped);
  const because = answer !== null && answer.versionId === result.versionId ? answer.text : null;

  return (
    <div className="now__result">
      <p className="now__result-text">{toPlainText(result.text)}</p>
      {versionId !== null && (canUndo || changed) && (
        <div className="now__result-actions">
          {canUndo && (
            <Button variant={ButtonVariant.Quiet} icon={IconName.Undo} onClick={() => void client.undo(versionId)}>
              Undo
            </Button>
          )}
          {changed && (
            <Button variant={ButtonVariant.Quiet} icon={IconName.Again} onClick={() => void client.again(versionId)}>
              Again
            </Button>
          )}
          {changed && because === null && (
            <Button variant={ButtonVariant.Quiet} icon={IconName.Help} onClick={() => void client.askWhy(versionId)}>
              Why?
            </Button>
          )}
        </div>
      )}
      {because !== null && <p className="now__why">{toPlainText(because)}</p>}
    </div>
  );
}
