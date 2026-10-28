import { randomUUID } from "node:crypto";
import type { UiEvent } from "../shared/events";
import type { MusicianQuestions } from "../tools/define";

interface WaitingQuestion {
  text: string;
  options: string[];
  resolve: (choice: string | null) => void;
}

export interface QuestionView {
  id: string;
  text: string;
  options: string[];
}

/** One-line questions to the musician, each with two to four buttons; Ode waits for the answer. */
export class Questions implements MusicianQuestions {
  private readonly waiting = new Map<string, WaitingQuestion>();

  constructor(private readonly emit: (event: UiEvent) => void) {}

  ask(text: string, options: string[]): Promise<string | null> {
    const id = randomUUID();
    return new Promise((resolve) => {
      this.waiting.set(id, { text, options, resolve });
      this.emit({ type: "question", id, text, options });
    });
  }

  /** The musician tapped an answer. False when the question is gone or the answer isn't one of its buttons. */
  answer(id: string, choice: string): boolean {
    const question = this.waiting.get(id);
    if (!question || !question.options.includes(choice)) return false;
    this.settle(id, choice);
    return true;
  }

  pending(): QuestionView[] {
    return [...this.waiting].map(([id, { text, options }]) => ({ id, text, options }));
  }

  /** The musician pressed Stop: every open question ends without an answer. */
  cancelAll(): void {
    for (const id of [...this.waiting.keys()]) this.settle(id, null);
  }

  private settle(id: string, choice: string | null): void {
    const question = this.waiting.get(id);
    if (!question) return;
    this.waiting.delete(id);
    question.resolve(choice);
    this.emit({ type: "question-resolved", id, choice });
  }
}
