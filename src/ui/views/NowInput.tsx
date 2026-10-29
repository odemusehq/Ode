import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant, TextInput } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";

const PLACEHOLDER = "Tell Ode what you want";

/** A short line for anything the suggestions leave out; Enter or Ask sends it. */
export function NowInput() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const [text, setText] = useState("");
  const inputId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    void client.send(text);
    setText("");
  };

  return (
    <form className="now__input" onSubmit={submit}>
      <label htmlFor={inputId} className="ode-visually-hidden">
        {PLACEHOLDER}
      </label>
      <TextInput
        id={inputId}
        value={text}
        placeholder={PLACEHOLDER}
        autoComplete="off"
        enterKeyHint="send"
        autoFocus
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" variant={ButtonVariant.Primary} disabled={busy || !text.trim()}>
        Ask
      </Button>
    </form>
  );
}
