import type { UiEvent } from "../../shared/events";
import { cx } from "./cx";
import { Markdown } from "./Markdown";
import "./ChatMessage.css";

export type ChatRole = Extract<UiEvent, { type: "message" }>["role"];

const AUTHORS: Record<ChatRole, string> = { user: "You", assistant: "Ode" };

export interface ChatMessageProps {
  role: ChatRole;
  text: string;
  /** The text is still arriving. */
  streaming?: boolean;
  /** Sent, but not yet received by Ode. */
  pending?: boolean;
}

export function ChatMessage({ role, text, streaming, pending }: ChatMessageProps) {
  return (
    <article
      className={cx("ode-message", `ode-message--${role}`, pending && "ode-message--pending")}
      aria-busy={streaming || undefined}
    >
      <div className="ode-message__author">{AUTHORS[role]}</div>
      <div className="ode-message__body">
        {role === "assistant" ? <Markdown text={text} /> : <p className="ode-message__plain">{text}</p>}
        {streaming && <span className="ode-message__caret" aria-hidden="true" />}
      </div>
    </article>
  );
}
