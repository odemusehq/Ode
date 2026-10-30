import { t } from "../../shared/i18n";
import { useCallback, useState } from "react";
import { ResultKind } from "../../shared/events";
import { Button, ButtonVariant, Icon, IconButton, IconName, toPlainText } from "../../ui-kit";
import { useAppState, useClient, useRequest } from "../app/hooks";
import { StreamState } from "../app/model";

/** The latest change remains attached to the dialogue; routine tool diagnostics stay out of it. */
export function ResultLine() {
  const client = useClient();
  const result = useAppState((state) => state.result);
  const answer = useAppState((state) => state.answer);
  const exchanges = useAppState((state) => state.exchanges);
  const busy = useAppState((state) => state.busy);
  const stream = useAppState((state) => state.stream);
  const versions = useAppState((state) => state.versions);
  if (!result) return null;
  const versionId = result.versionId;
  const version = versions?.find((item) => item.id === versionId);
  const changed = result.kind === ResultKind.Change;
  const canUndo = versionId !== null && version?.scopedUndo === true;
  const canAgain = canUndo && changed && Boolean(version?.request);
  const because = answer?.versionId === result.versionId ? answer?.text : null;
  const duplicate = exchanges.some((exchange) => exchange.reply === result.text);
  const disabled = busy || stream !== StreamState.Open;
  return <div className="now__result">
    {!duplicate && <p className="now__result-text">{toPlainText(result.text)}</p>}
    {result.versionId && !exchanges.some((exchange) => exchange.versionId === result.versionId) && <ActualChanges versionId={result.versionId} />}
    {versionId !== null && (canUndo || changed) && <div className="now__result-actions">
      {canUndo && <Button variant={ButtonVariant.Quiet} icon={IconName.Undo} disabled={disabled} onClick={() => void client.undo(versionId)}>{t("chat.undo")}</Button>}
      {canAgain && <Button variant={ButtonVariant.Quiet} icon={IconName.Again} disabled={disabled} onClick={() => void client.again(versionId)}>{t("chat.again")}</Button>}
      {changed && !because && <Button variant={ButtonVariant.Quiet} icon={IconName.Help} disabled={disabled} onClick={() => void client.askWhy(versionId)}>{t("chat.why")}</Button>}
    </div>}
    {because && <p className="now__why">{toPlainText(because)}</p>}
  </div>;
}

export function ActualChanges({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="now__changes" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{t("chat.whatChanged")}</summary>
    {open && <ChangeList versionId={versionId} />}
  </details>;
}

function ChangeList({ versionId }: { versionId: string }) {
  const client = useClient();
  const load = useCallback(() => client.api.getVersion(versionId), [client, versionId]);
  const { data, error } = useRequest(load);
  if (error) return <p className="small muted">{t("chat.changesUnavailable")}</p>;
  if (!data) return <p className="small muted">{t("history.readingChanges")}</p>;
  const changes = data.version.changes;
  if (!changes.length) return null;
  return <ul>{changes.map((change, index) => <li key={index}>{change.label}</li>)}</ul>;
}

/** Brief feedback stays beside the composer while the conversation above scrolls. */
export function RequestFeedback() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const progress = useAppState((state) => state.progress);
  const questions = useAppState((state) => state.questions);
  const approvals = useAppState((state) => state.approvals);
  const error = useAppState((state) => state.error);
  const stream = useAppState((state) => state.stream);
  const exchanges = useAppState((state) => state.exchanges);
  const steps = useAppState((state) => state.steps);
  const thought = useAppState((state) => state.thought);
  const waiting = questions.length + approvals.length > 0;
  const hasInlineActivity = exchanges.some((exchange) => exchange.status === "running" && (exchange.activity?.length || exchange.rationale || steps.length || thought));
  return <>
    {busy && !waiting && (!hasInlineActivity || stream !== StreamState.Open) && <p className="now__feedback" role="status">{stream === StreamState.Open ? (progress ?? t("activity.working")) : t("chat.connectionLost")}</p>}
    {error && <div className="now__error" role="alert"><Icon name={IconName.Alert} /><p className="now__error-text">{error}</p><IconButton icon={IconName.Close} label={t("chat.dismissError")} onClick={() => client.store.setError(null)} /></div>}
  </>;
}
