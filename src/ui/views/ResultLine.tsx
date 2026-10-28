import { ActivityLine, ActivityStatus, Button, ButtonVariant, Icon, IconButton, IconName, toPlainText } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import { WhyStatus } from "../app/model";

const WORKING = "Working…";
const WAITING_FOR_WHY = "…";

/**
 * While Ode works: one line of progress with Stop. Then one line saying what changed and what was checked,
 * with Undo, Again and Why?, and the short answer to Why? under it. A failure is one line too.
 */
export function ResultLine() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const progress = useAppState((state) => state.progress);
  const result = useAppState((state) => state.result);
  const why = useAppState((state) => state.why);
  const error = useAppState((state) => state.error);

  return (
    <div className="now__status">
      <div className="now__live" role="status">
        {busy ? (
          <div className="now__progress">
            <ActivityLine status={ActivityStatus.Running} text={progress ?? WORKING} />
            <Button icon={IconName.Stop} onClick={() => void client.stopRequest()}>
              Stop
            </Button>
          </div>
        ) : (
          result && (
            <div className="now__result">
              <p className="now__result-text">{toPlainText(result.text)}</p>
              <div className="now__result-actions">
                {result.versionId !== null && (
                  <Button variant={ButtonVariant.Quiet} icon={IconName.Undo} title="Go back to the version before this change" onClick={() => void client.undo()}>
                    Undo
                  </Button>
                )}
                <Button variant={ButtonVariant.Quiet} icon={IconName.Again} title="Try a different take, in place" onClick={() => void client.again()}>
                  Again
                </Button>
                {!result.undone && (
                  <Button
                    variant={ButtonVariant.Quiet}
                    icon={IconName.Help}
                    title="A short answer on why Ode did this"
                    disabled={why !== null}
                    onClick={() => void client.askWhy()}
                  >
                    Why?
                  </Button>
                )}
              </div>
              {why && (
                <p className="now__why">{why.status === WhyStatus.Answered || why.text ? toPlainText(why.text) : WAITING_FOR_WHY}</p>
              )}
            </div>
          )
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
