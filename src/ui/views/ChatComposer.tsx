import { useId, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Button, ButtonVariant, IconName, TextArea } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";

/** Message box: Enter sends, Shift+Enter starts a new line; Stop ends Ode's current work. */
export function ChatComposer() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const pointer = useAppState((state) => state.pointer);
  const [text, setText] = useState("");
  const inputId = useId();
  const hintId = useId();

  const send = () => {
    if (!text.trim()) return;
    void client.send(text);
    setText("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form className="chat__composer" onSubmit={handleSubmit}>
      {pointer && (
        <p className="chat__context" title={pointer.description}>
          From Live: {pointer.description}
        </p>
      )}
      <label htmlFor={inputId} className="ode-visually-hidden">
        Message to Ode
      </label>
      <TextArea
        id={inputId}
        className="chat__input"
        rows={1}
        value={text}
        placeholder="Ask Ode…"
        aria-describedby={hintId}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="chat__actions">
        <p id={hintId} className="chat__hint">
          Enter to send, Shift+Enter for a new line
        </p>
        <Button icon={IconName.Stop} disabled={!busy} onClick={() => void client.stopRequest()}>
          Stop
        </Button>
        <Button type="submit" variant={ButtonVariant.Primary} icon={IconName.Send} disabled={!text.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
}
