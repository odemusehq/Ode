import { randomUUID } from "node:crypto";
import type { UiEvent } from "../shared/events";
import type { MusicianQuestions } from "../tools/define";

export interface QuestionView {
  id: string;
  text: string;
  options: string[];
  /** Release files shown as the answers, one per option. */
  images?: string[];
}

interface WaitingQuestion {
  view: QuestionView;
  resolve: (choice: string | null) => void;
}

/** One-line questions to the musician, each with two to four buttons; Ode waits for the answer. */
export class Questions implements MusicianQuestions {
  private readonly waiting = new Map<string, WaitingQuestion>();

  constructor(private readonly emit: (event: UiEvent) => void) {}

  ask(text: string, options: string[], images?: string[]): Promise<string | null> {
    const id = randomUUID();
    const view: QuestionView = images && images.length > 0 ? { id, text, options, images } : { id, text, options };
    return new Promise((resolve) => {
      this.waiting.set(id, { view, resolve });
      this.emit({ type: "question", ...view });
    });
  }

  /** The musician tapped an answer. False when the question is gone or the answer is outside its buttons. */
  answer(id: string, choice: string): boolean {
    const question = this.waiting.get(id);
    if (!question || !choice.trim()) return false;
    this.settle(id, choice);
    return true;
  }

  /** A plain chat reply answers the oldest pending question. */
  reply(text: string): boolean {
    const [id] = this.waiting.keys();
    return id !== undefined && this.answer(id, text);
  }

  /** The questions still waiting, for a window that just connected. */
  pending(): QuestionView[] {
    return [...this.waiting.values()].map(({ view }) => view);
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
