import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant } from "../../ui-kit";
import type { AudioScope } from "../app/api";
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
  const composer = useSyncExternalStore(client.composer.subscribe, client.composer.getSnapshot);
  const { text, attachments } = composer.draft;
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    }
    previousSong.current = songId;
  }, [songId, cancelDictation]);

  useEffect(() => { void client.composer.open(songId); }, [client, songId]);

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
      client.composer.appendText(transcript);
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
    if (voice.current || !intendedSong || !composer.loaded || !dictationReady || !supportsDictation || sending || uploading) return;
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
    setSending(true);
    try {
      await client.sendDraft();
    } finally {
      setSending(false);
      field.current?.focus();
    }
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length || voice.current) return;
    setUploading(true);
    const attachedSong = currentSong.current;
    if (!attachedSong) { setUploading(false); return; }
    try {
      for (const file of Array.from(files)) {
        await client.attachAudio(file, scope, source, attachedSong);
        if (currentSong.current !== attachedSong) return;
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
        {attachments.map((file) => <li key={file.entryId}>
          <span>{file.name}</span>
          <Button variant={ButtonVariant.Quiet} aria-label={`Remove ${file.name}`} onClick={() => client.composer.removeAttachment(file.entryId)}>Remove</Button>
        </li>)}
      </ul>}
      <label htmlFor={inputId} className="ode-visually-hidden">Message Ode</label>
      <textarea ref={field} id={inputId} className="ode-input now__field" value={text} rows={2} disabled={!composer.loaded || composer.songId !== songId}
        placeholder={busy ? "Add a detail or change direction…" : "Tell Ode what you want…"}
        aria-describedby={`${inputId}-hint`} autoComplete="off" autoFocus
        onChange={(event) => client.composer.editText(event.target.value)}
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
            <label>WAV or AIFF files <input type="file" accept=".wav,.aif,.aiff" multiple disabled={uploading || !composer.loaded || voicePhase !== "idle"} onChange={(event) => { void attach(event.target.files); event.target.value = ""; }} /></label>
            <p className="small muted">A supplied bounce is a snapshot. Export a new bounce after changing the sound in Live.</p>
          </div>
        </details>
        <Button variant={ButtonVariant.Quiet}
          disabled={voicePhase === "permission" || voicePhase === "transcribing" || (voicePhase === "idle" && (!supportsDictation || !dictationReady || !songId || !composer.loaded || sending || uploading))}
          aria-pressed={voicePhase === "recording"} aria-label={voicePhase === "recording" ? "Finish dictation" : "Dictate message"}
          title={!supportsDictation ? "Microphone recording is unavailable in this browser. You can type your message." : !dictationReady ? "Add a Meta key in Ode: Settings to transcribe dictated messages." : "Record a message into the draft; Send submits it."}
          onClick={() => { if (voicePhase === "recording") void finishDictation(); else void startDictation(); }}>
          {voicePhase === "recording" ? "Finish" : voicePhase === "permission" ? "Microphone…" : voicePhase === "transcribing" ? "Transcribing…" : "Dictate"}
        </Button>
        {voicePhase !== "idle" && <Button variant={ButtonVariant.Quiet} onClick={() => { cancelDictation(); field.current?.focus(); }}>Cancel dictation</Button>}
        <span id={`${inputId}-hint`} className="now__input-hint">{uploading ? "Attaching audio…" : "Shift+Enter for a new line"}</span>
        {((busy && stoppable) || sending || composer.pending) && <Button variant={ButtonVariant.Secondary} onClick={() => { cancelDictation(); void client.stopRequest(); }}>Stop</Button>}
        <Button type="submit" variant={ButtonVariant.Primary} disabled={sending || uploading || !composer.loaded || !composer.valid || composer.conflicts.length > 0 || voicePhase !== "idle" || (!text.trim() && attachments.length === 0)}>{sending ? "Sending…" : "Send"}</Button>
      </div>
      {composer.error && <p className="small" role="status">{composer.error} {composer.conflicts.length === 0 && <Button variant={ButtonVariant.Quiet} onClick={() => { void (composer.loaded ? client.composer.flush() : client.composer.open(songId, true)); }}>Retry</Button>}</p>}
      {composer.conflicts.length > 0 && <p className="small" role="status">Another draft was saved. <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("local").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>Keep this draft</Button> <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("saved").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>Use saved draft</Button></p>}
      {voicePhase !== "idle" && <p className="small muted" role="status">{voicePhase === "permission" ? "Waiting for microphone permission…" : voicePhase === "recording" ? "Recording · up to 60 seconds · Escape cancels" : "Transcribing…"}</p>}
    </form>
  );
}
