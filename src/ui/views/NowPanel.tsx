import { useLayoutEffect, useRef } from "react";
import { Button, ButtonVariant } from "../../ui-kit";
import { useAppState } from "../app/hooks";
import { ApplyCard } from "./ApplyCard";
import { NowInput } from "./NowInput";
import { QuestionCard } from "./QuestionCard";
import { ActualChanges, RequestFeedback, ResultLine } from "./ResultLine";
import { WorkingSteps } from "./WorkingSteps";
import type { Step } from "../app/model";
import "./NowPanel.css";

/** The saved dialogue and actual changes, with decisions and the composer always within reach. */
export function NowPanel() {
  const exchanges = useAppState((state) => state.exchanges);
  const questions = useAppState((state) => state.questions);
  const approvals = useAppState((state) => state.approvals);
  const steps = useAppState((state) => state.steps);
  const thought = useAppState((state) => state.thought);
  const activeId = exchanges.find((exchange) => exchange.status === "running")?.id;
  const waiting = questions.length + approvals.length;
  const conversation = useRef<HTMLDivElement>(null);
  const decisions = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const lastTurn = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const turn = exchanges.at(-1)?.id;
    if (lastTurn.current !== turn) atEnd.current = true;
    lastTurn.current = turn;
    if (atEnd.current && conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [exchanges, steps, thought, waiting]);

  return (
    <section className="now" aria-label="Conversation with Ode">
      <div className="now__conversation" ref={conversation} onScroll={() => {
        const node = conversation.current;
        if (node) atEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
      }}>
        {exchanges.length === 0 && <p className="now__empty">Talk through an idea, ask about the song, or tell Ode what to change.</p>}
        <div role="log" aria-label="Saved conversation" aria-live="polite" aria-relevant="additions text">
          {exchanges.map((exchange) => <article className="now__exchange" key={exchange.id}>
            {exchange.request && <div className="now__message now__message--user"><h2>You</h2><p>{exchange.request.replace(/^Managed path: .*$/gm, "").trim()}</p></div>}
            <WorkingSteps steps={exchange.id === activeId ? mergeSteps(exchange.activity ?? [], steps) : exchange.activity ?? []}
              rationale={exchange.id === activeId ? thought ?? exchange.rationale : exchange.rationale} active={exchange.id === activeId} />
            {exchange.reply && <div className="now__message now__message--assistant"><h2>Ode</h2><p>{exchange.reply}</p></div>}
            {exchange.versionId && <ActualChanges versionId={exchange.versionId} />}
            {(exchange.status === "failed" || exchange.status === "stopped") && <p className="now__turn-status">{exchange.status === "failed" ? "This request failed." : "This request was stopped."}</p>}
          </article>)}
        </div>
        <ResultLine />
      </div>
      {waiting > 0 && <div className="now__waiting">
        <p role="status">Ode is waiting for your decision. <Button variant={ButtonVariant.Quiet} onClick={() => decisions.current?.querySelector<HTMLElement>("button, input, textarea")?.focus()}>Go to decision</Button></p>
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
