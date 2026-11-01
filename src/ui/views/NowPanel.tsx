import { t } from "../../shared/i18n";
import { useLayoutEffect, useRef } from "react";
import { Button, ButtonVariant, cx } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";
import { ApplyCard } from "./ApplyCard";
import { ReferenceChips } from "./ReferenceChips";
import { NowInput } from "./NowInput";
import { QuestionCard } from "./QuestionCard";
import { ActualChanges, RequestFeedback, ResultLine } from "./ResultLine";
import { WorkingSteps } from "./WorkingSteps";
import { StreamState, type Step } from "../app/model";
import "./NowPanel.css";

/** The saved dialogue and actual changes, with decisions and the composer always within reach. */
export function NowPanel() {
  const client = useClient();
  const exchanges = useAppState((state) => state.exchanges);
  const questions = useAppState((state) => state.questions);
  const approvals = useAppState((state) => state.approvals);
  const steps = useAppState((state) => state.steps);
  const thought = useAppState((state) => state.thought);
  const progress = useAppState((state) => state.progress);
  const busy = useAppState((state) => state.busy);
  const stream = useAppState((state) => state.stream);
  const activeId = exchanges.find((exchange) => exchange.status === "running")?.id;
  const waiting = questions.length + approvals.length;
  const conversation = useRef<HTMLDivElement>(null);
  const decisions = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);

  useLayoutEffect(() => {
    if (atEnd.current && conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [exchanges, steps, thought, progress, busy, waiting]);

  return (
    <section className={cx("now", (busy || activeId) && stream === StreamState.Open && "now--live-feedback")} aria-label={t("chat.conversation")}>
      <div className="now__conversation" ref={conversation} onScroll={() => {
        const node = conversation.current;
        if (node) atEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
      }}>
        <div role="log" aria-label={t("chat.savedConversation")} aria-live="polite" aria-relevant="additions text">
          {exchanges.map((exchange) => <article className="now__exchange" key={exchange.id}>
            {(exchange.request || exchange.attachments?.length) && <div className="now__message now__message--user"><h2>{t("common.you")}</h2>{exchange.request && <p>{exchange.request}</p>}<ReferenceChips files={exchange.attachments ?? []} /></div>}
            <WorkingSteps steps={exchange.id === activeId && busy ? mergeSteps(exchange.activity ?? [], steps) : exchange.activity ?? []}
              rationale={exchange.id === activeId && busy ? thought ?? exchange.rationale : exchange.rationale}
              progress={exchange.id === activeId && busy ? progress : null} active={exchange.id === activeId} waiting={exchange.id === activeId && waiting > 0} />
            {Boolean(exchange.reply) && <div className="now__message now__message--assistant">
              <h2>{t("common.ode")}</h2>
              {exchange.reply && <p>{exchange.reply}</p>}

            </div>}
            {exchange.versionId && <ActualChanges versionId={exchange.versionId} />}
            {(exchange.status === "failed" || exchange.status === "stopped") && <p className="now__turn-status">{exchange.status === "failed" ? t("chat.requestFailed") : t("chat.requestStopped")}</p>}
          </article>)}
          {busy && !activeId && <div className="now__exchange">
            <WorkingSteps steps={steps} rationale={thought} progress={progress} active waiting={waiting > 0} />
          </div>}
        </div>
        <ResultLine />
      </div>
      {waiting > 0 && <div className="now__waiting">
        <p role="status">{t("decisions.waiting")} <Button variant={ButtonVariant.Quiet} onClick={() => decisions.current?.querySelector<HTMLElement>("button, input, textarea")?.focus()}>{t("decisions.goToDecision")}</Button></p>
        <div className="now__decisions" ref={decisions}>
          {questions.map((question) => <QuestionCard key={question.id} question={question} />)}
          {approvals.map((approval) => <ApplyCard key={approval.id} approval={approval} />)}
        </div>
      </div>}
      <RequestFeedback />
      <NowInput />
    </section>
  );
}

function mergeSteps(saved: readonly Step[], live: readonly Step[]): Step[] {
  const merged = new Map(saved.map((step) => [step.id, step]));
  for (const step of live) merged.set(step.id, { ...merged.get(step.id), ...step });
  return [...merged.values()];
}
