import { Button, ButtonVariant, Card, Tone } from "../../ui-kit";
import { useClient } from "../app/hooks";
import type { Question } from "../app/model";

export interface QuestionCardProps {
  question: Question;
}

/** Ode's one-line question with its two to four answers; the first is Ode's suggestion. */
export function QuestionCard({ question }: QuestionCardProps) {
  const client = useClient();
  return (
    <Card
      kicker="Question"
      tone={Tone.Info}
      waiting={question.answered}
      actions={question.options.map((option, index) => (
        <Button
          key={`${index}-${option}`}
          variant={index === 0 ? ButtonVariant.Primary : ButtonVariant.Secondary}
          disabled={question.answered}
          onClick={() => void client.answer(question.id, option)}
        >
          {option}
        </Button>
      ))}
    >
      {question.text}
    </Card>
  );
}
