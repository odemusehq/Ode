import { useAppState } from "../app/hooks";
import { ApplyCard } from "./ApplyCard";
import { NowInput } from "./NowInput";
import { QuestionCard } from "./QuestionCard";
import { ResultLine } from "./ResultLine";
import { SuggestionChips } from "./SuggestionChips";
import { WorkingSteps } from "./WorkingSteps";
import "./NowPanel.css";

const WHOLE_SONG = "Whole song";

/** The body of Ask Ode: what you're on, suggestions, the input, what Ode is doing or did, its steps, and its questions. */
export function NowPanel() {
  const focus = useAppState((state) => state.focus) ?? WHOLE_SONG;
  const questions = useAppState((state) => state.questions);
  const approvals = useAppState((state) => state.approvals);

  return (
    <section className="now" aria-label="Now">
      <p className="now__focus">
        <span className="now__focus-label">What you're on</span>
        <span className="now__focus-text" title={focus}>
          {focus}
        </span>
      </p>
      <SuggestionChips />
      <NowInput />
      <ResultLine />
      <WorkingSteps />
      {questions.map((question) => (
        <QuestionCard key={question.id} question={question} />
      ))}
      {approvals.map((approval) => (
        <ApplyCard key={approval.id} approval={approval} />
      ))}
    </section>
  );
}
