import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, IconName, TextInput, cx } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { UI_CONFIG } from "../app/config";
import { useAppState, useClient } from "../app/hooks";
import { SpeechRecorder } from "../app/speech-recorder";

enum ListenState {
  Idle = "idle",
  Recording = "recording",
  Sending = "sending",
}

const LISTEN_LABELS: Record<ListenState, string> = {
  [ListenState.Idle]: "Listen",
  [ListenState.Recording]: "Stop",
  [ListenState.Sending]: "Sending…",
};

const LISTEN_TITLES: Record<ListenState, string> = {
  [ListenState.Idle]: "Say what you want; press again when you're done",
  [ListenState.Recording]: "Stop listening and send what you said",
  [ListenState.Sending]: "Sending what you said",
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
    try {
      await recorder.start();
      setHeard(null);
      setListen(ListenState.Recording);
    } catch (error) {
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
        icon={listen === ListenState.Recording ? IconName.Stop : IconName.Microphone}
        className={cx(listen === ListenState.Recording && "now__listening")}
        aria-pressed={listen === ListenState.Recording}
        title={LISTEN_TITLES[listen]}
        disabled={listen === ListenState.Sending}
        onClick={toggleListening}
      >
        {LISTEN_LABELS[listen]}
      </Button>
      <Button
        icon={IconName.Note}
        title={`Sing over the next ${UI_CONFIG.humBars} bars; Ode turns it into MIDI on the selected track`}
        disabled={busy}
        onClick={() => void client.hum()}
      >
        Hum
      </Button>
      {heard && <p className="now__heard">Heard: “{heard}”</p>}
    </form>
  );
}
