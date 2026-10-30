import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant } from "../../ui-kit";
import type { AudioAttachment, AudioScope } from "../app/api";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";
import { DictationRecorder, dictationSupported } from "../app/dictation";

type DictationPhase = "idle" | "permission" | "recording" | "transcribing";
interface ActiveDictation {
  recorder: DictationRecorder;
  controller: AbortController;
  songId: string;
  epoch: number;
  finishing: boolean;
}

/** The continuing conversation: Enter sends, Shift+Enter adds a line, and Stop stays reachable. */
export function NowInput() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const stoppable = useAppState((state) => state.stoppable);
  const songId = useAppState((state) => state.songId);
  const dictationReady = useAppState((state) => state.dictationReady);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<AudioAttachment[]>([]);
  const [scope, setScope] = useState<AudioScope>("reference");
  const [source, setSource] = useState("");
  const [voicePhase, setVoicePhase] = useState<DictationPhase>("idle");
  const [supportsDictation] = useState(dictationSupported);
  const inputId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const previousSong = useRef(songId);
  const currentSong = useRef(songId);
  const voice = useRef<ActiveDictation | null>(null);
  const voiceEpoch = useRef(0);
  const mounted = useRef(true);
  currentSong.current = songId;

  const cancelDictation = useCallback(() => {
    voiceEpoch.current++;
    const active = voice.current;
    voice.current = null;
    active?.controller.abort();
    active?.recorder.cancel();
    if (mounted.current) setVoicePhase("idle");
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelDictation(); };
  }, [cancelDictation]);

  useEffect(() => {
    if (previousSong.current !== null && songId !== previousSong.current) {
      cancelDictation();
      setText("");
      setAttachments([]);
    }
    previousSong.current = songId;
  }, [songId, cancelDictation]);

  useEffect(() => {
    if (voicePhase === "idle") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelDictation();
      field.current?.focus();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [voicePhase, cancelDictation]);

  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = "auto";
    field.current.style.height = `${Math.min(field.current.scrollHeight, 180)}px`;
  }, [text]);

  const isCurrentDictation = (active: ActiveDictation) => mounted.current && voice.current === active &&
    voiceEpoch.current === active.epoch && currentSong.current === active.songId && !active.controller.signal.aborted;

  const finishDictation = async () => {
    const active = voice.current;
    if (!active || active.finishing) return;
    active.finishing = true;
    setVoicePhase("transcribing");
    try {
      const file = await active.recorder.finish();
      if (!isCurrentDictation(active)) return;
      const result = await client.api.transcribe(file, active.songId, active.controller.signal);
      if (!isCurrentDictation(active)) return;
      if (result.songId !== active.songId) throw new Error("The open song changed. Record the message again in the intended song.");
      const transcript = result.text.trim();
      if (!transcript) throw new Error("No words were recognised. Record again or type your message.");
      // Functional append preserves edits made while permission, recording or transcription was pending.
      setText((current) => current + (current && !/\s$/.test(current) ? " " : "") + transcript);
    } catch (error) {
      if (isCurrentDictation(active)) client.store.setError(`Dictation stopped: ${errorMessage(error)}`);
    } finally {
      active.recorder.cancel();
      if (voice.current === active) {
        voice.current = null;
        if (mounted.current) { setVoicePhase("idle"); field.current?.focus(); }
      }
    }
  };

  const startDictation = async () => {
    const intendedSong = currentSong.current;
    if (voice.current || !intendedSong || !dictationReady || !supportsDictation || sending || uploading) return;
    const active: ActiveDictation = {
      songId: intendedSong,
      epoch: ++voiceEpoch.current,
      controller: new AbortController(),
      finishing: false,
      recorder: new DictationRecorder(() => { void finishDictation(); }, (error) => {
        if (!isCurrentDictation(active)) return;
        client.store.setError(errorMessage(error));
        cancelDictation();
      }),
    };
    voice.current = active;
    setVoicePhase("permission");
    client.store.setError(null);
    try {
      await active.recorder.start();
      if (isCurrentDictation(active)) setVoicePhase("recording");
      else active.recorder.cancel();
    } catch (error) {
      if (isCurrentDictation(active)) {
        client.store.setError(`Dictation did not start: ${errorMessage(error)}`);
        cancelDictation();
      }
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!text.trim() && attachments.length === 0) || sending || uploading || voice.current) return;
    const sentText = text;
    const sentAttachments = attachments;
    const sentSong = currentSong.current;
    const audio = sentAttachments.map((file) => `Audio attachment (${file.scope}): ${file.name}\nManaged audio ID: ${file.id} (reopen with library_audio_open if the working path expires)\nManaged path: ${file.path}`).join("\n\n");
    const request = [sentText, audio].filter(Boolean).join("\n\n");
    setSending(true);
    try {
      if (await client.send(request) && currentSong.current === sentSong) {
        setText((current) => current === sentText ? "" : current);
        setAttachments((current) => current.filter((file) => !sentAttachments.includes(file)));
      }
    } finally {
      setSending(false);
      field.current?.focus();
    }
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length || voice.current) return;
    setUploading(true);
    const attachedSong = currentSong.current;
    try {
      for (const file of Array.from(files)) {
        const imported = await client.api.importAudio(file, scope, source);
        if (currentSong.current !== attachedSong) return;
        setAttachments((current) => [...current, imported]);
      }
    } catch (error) {
      client.store.setError(`Attaching audio stopped: ${errorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="now__composer" onSubmit={(event) => void submit(event)}>
      {attachments.length > 0 && <ul className="now__attachments" aria-label="Attached audio">
        {attachments.map((file, index) => <li key={`${file.path}-${index}`}>
          <span>{file.name}</span>
          <Button variant={ButtonVariant.Quiet} aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))}>Remove</Button>
        </li>)}
      </ul>}
      <label htmlFor={inputId} className="ode-visually-hidden">Message Ode</label>
      <textarea ref={field} id={inputId} className="ode-input now__field" value={text} rows={2}
        placeholder={busy ? "Add a detail or change direction…" : "Tell Ode what you want…"}
        aria-describedby={`${inputId}-hint`} autoComplete="off" autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} />
      <div className="now__composer-actions">
        <details className="now__attach">
          <summary>Attach audio</summary>
          <div className="now__attach-fields">
            <label>Audio role <select value={scope} onChange={(event) => setScope(event.target.value as AudioScope)}>
              <option value="reference">Reference</option><option value="sample">Sample</option><option value="processed-bounce">Processed bounce</option>
            </select></label>
            <label>Source or bounce details <input className="ode-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder="For example, Main export, bars 1–33, effects included" /></label>
            <label>WAV or AIFF files <input type="file" accept=".wav,.aif,.aiff" multiple disabled={uploading || voicePhase !== "idle"} onChange={(event) => { void attach(event.target.files); event.target.value = ""; }} /></label>
            <p className="small muted">A supplied bounce is a snapshot. Export a new bounce after changing the sound in Live.</p>
          </div>
        </details>
        <Button variant={ButtonVariant.Quiet}
          disabled={voicePhase === "permission" || voicePhase === "transcribing" || (voicePhase === "idle" && (!supportsDictation || !dictationReady || !songId || sending || uploading))}
          aria-pressed={voicePhase === "recording"} aria-label={voicePhase === "recording" ? "Finish dictation" : "Dictate message"}
          title={!supportsDictation ? "Microphone recording is unavailable in this browser. You can type your message." : !dictationReady ? "Add a Meta key in Ode: Settings to transcribe dictated messages." : "Record a message into the draft; Send submits it."}
          onClick={() => { if (voicePhase === "recording") void finishDictation(); else void startDictation(); }}>
          {voicePhase === "recording" ? "Finish" : voicePhase === "permission" ? "Microphone…" : voicePhase === "transcribing" ? "Transcribing…" : "Dictate"}
        </Button>
        {voicePhase !== "idle" && <Button variant={ButtonVariant.Quiet} onClick={() => { cancelDictation(); field.current?.focus(); }}>Cancel dictation</Button>}
        <span id={`${inputId}-hint`} className="now__input-hint">{uploading ? "Attaching audio…" : "Shift+Enter for a new line"}</span>
        {((busy && stoppable) || sending) && <Button variant={ButtonVariant.Secondary} onClick={() => { cancelDictation(); void client.stopRequest(); }}>Stop</Button>}
        <Button type="submit" variant={ButtonVariant.Primary} disabled={sending || uploading || voicePhase !== "idle" || (!text.trim() && attachments.length === 0)}>{sending ? "Sending…" : "Send"}</Button>
      </div>
      {voicePhase !== "idle" && <p className="small muted" role="status">{voicePhase === "permission" ? "Waiting for microphone permission…" : voicePhase === "recording" ? "Recording · up to 60 seconds · Escape cancels" : "Transcribing…"}</p>}
    </form>
  );
}
