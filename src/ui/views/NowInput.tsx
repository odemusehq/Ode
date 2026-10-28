import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, IconName, TextInput, cx } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";
import { SpeechRecorder } from "../app/speech-recorder";

enum ListenState {
  Idle = "idle",
  Starting = "starting",
  Recording = "recording",
  Sending = "sending",
}

const LISTEN_LABELS: Record<ListenState, string> = {
  [ListenState.Idle]: "Listen",
  [ListenState.Starting]: "Starting…",
  [ListenState.Recording]: "Stop",
  [ListenState.Sending]: "Sending…",
};

const PLACEHOLDER = "Tell Ode what you want";

/** A short line for anything the suggestions don't cover (Enter sends), with Listen and Hum. */
export function NowInput() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const [text, setText] = useState("");
  const [listen, setListen] = useState(ListenState.Idle);
  const [heard, setHeard] = useState<string | null>(null);
  const recorder = useMemo(() => new SpeechRecorder(), []);
  const inputId = useId();

  useEffect(() => () => recorder.cancel(), [recorder]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    void client.send(text);
    setText("");
    setHeard(null);
  };

  const startListening = async () => {
    setListen(ListenState.Starting);
    try {
      await recorder.start();
      setHeard(null);
      setListen(ListenState.Recording);
    } catch (error) {
      setListen(ListenState.Idle);
      client.store.setError(`Ode can't use the microphone: ${errorMessage(error)}`);
    }
  };

  const stopListening = async () => {
    setListen(ListenState.Sending);
    try {
      setHeard(await client.sendSpeech(await recorder.stop()));
    } catch (error) {
      client.store.setError(`What you said wasn't recorded: ${errorMessage(error)}`);
    } finally {
      setListen(ListenState.Idle);
    }
  };

  const toggleListening = () => {
    if (listen === ListenState.Idle) void startListening();
    else if (listen === ListenState.Recording) void stopListening();
  };

  const recording = listen === ListenState.Recording;

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
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        icon={recording ? IconName.Stop : IconName.Microphone}
        className={cx(recording && "now__listening")}
        disabled={listen === ListenState.Starting || listen === ListenState.Sending}
        onClick={toggleListening}
      >
        {LISTEN_LABELS[listen]}
      </Button>
      <Button icon={IconName.Note} disabled={busy} onClick={() => void client.hum()}>
        Hum
      </Button>
      {heard && <p className="now__heard">Heard: “{heard}”</p>}
    </form>
  );
}
