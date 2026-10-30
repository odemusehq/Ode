import { t } from "../../shared/i18n";
import { useId, useState } from "react";
import { Button, ButtonVariant, Card, Tone } from "../../ui-kit";
import { useClient } from "../app/hooks";
import type { Question } from "../app/model";

export interface QuestionCardProps {
  question: Question;
}

/** Ode's one-line question with its two to four answers; the first is Ode's suggestion. Cover art answers show their image. */
export function QuestionCard({ question }: QuestionCardProps) {
  const client = useClient();
  const [answer, setAnswer] = useState("");
  const answerId = useId();
  const pictured = question.images.length > 0;

  const answers = question.options.map((option, index) => {
    const image = question.images[index];
    const choose = () => void client.answer(question.id, option);
    if (image) {
      return (
        <button key={`${index}-${option}`} type="button" className="now-answer" disabled={question.answered} onClick={choose}>
          <img className="now-answer__image" src={client.api.releaseFileUrl(image)} alt="" />
          <span className="now-answer__label">{option}</span>
        </button>
      );
    }
    return (
      <Button
        key={`${index}-${option}`}
        variant={index === 0 && !pictured ? ButtonVariant.Primary : ButtonVariant.Secondary}
        disabled={question.answered}
        onClick={choose}
      >
        {option}
      </Button>
    );
  });

  return (
    <Card tone={Tone.Info} waiting={question.answered} actions={answers}>
      <p>{question.text}</p>
      <form className="now__custom-answer" onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim()) void client.answer(question.id, answer.trim());
      }}>
        <label htmlFor={answerId} className="ode-visually-hidden">{t("decisions.ownAnswer")}</label>
        <input id={answerId} className="ode-input" placeholder={t("decisions.answerPlaceholder")} value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={question.answered} />
        <Button type="submit" variant={ButtonVariant.Secondary} disabled={question.answered || !answer.trim()}>{t("decisions.answer")}</Button>
      </form>
    </Card>
  );
}
