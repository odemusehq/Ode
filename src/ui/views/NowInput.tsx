import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant } from "../../ui-kit";
import type { AudioAttachment, AudioScope } from "../app/api";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";

/** The continuing conversation: Enter sends, Shift+Enter adds a line, and Stop stays reachable. */
export function NowInput() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const stoppable = useAppState((state) => state.stoppable);
  const songId = useAppState((state) => state.songId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<AudioAttachment[]>([]);
  const [scope, setScope] = useState<AudioScope>("reference");
  const [source, setSource] = useState("");
  const inputId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const previousSong = useRef(songId);
  const currentSong = useRef(songId);
  currentSong.current = songId;

  useEffect(() => {
    if (previousSong.current !== null && songId !== previousSong.current) {
      setText("");
      setAttachments([]);
    }
    previousSong.current = songId;
  }, [songId]);

  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = "auto";
    field.current.style.height = `${Math.min(field.current.scrollHeight, 180)}px`;
  }, [text]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!text.trim() && attachments.length === 0) || sending || uploading) return;
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
    if (!files?.length) return;
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
            <label>WAV or AIFF files <input type="file" accept=".wav,.aif,.aiff" multiple disabled={uploading} onChange={(event) => { void attach(event.target.files); event.target.value = ""; }} /></label>
            <p className="small muted">A supplied bounce is a snapshot. Export a new bounce after changing the sound in Live.</p>
          </div>
        </details>
        <span id={`${inputId}-hint`} className="now__input-hint">{uploading ? "Attaching audio…" : "Shift+Enter for a new line"}</span>
        {busy && stoppable && <Button variant={ButtonVariant.Secondary} onClick={() => void client.stopRequest()}>Stop</Button>}
        <Button type="submit" variant={ButtonVariant.Primary} disabled={sending || uploading || (!text.trim() && attachments.length === 0)}>{sending ? "Sending…" : "Send"}</Button>
      </div>
    </form>
  );
}
