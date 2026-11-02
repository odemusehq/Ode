import { t } from "../../shared/i18n";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant, IconButton, IconName } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";
import { REFERENCE_ACCEPT, selectedReferences, droppedReferences, type ReferenceSelection } from "../app/references";
import { ReferenceChips } from "./ReferenceChips";
import { MicrophoneRecorder, microphoneSupported, type RecordingKind } from "../app/microphone";

type RecordingPhase = "idle" | "permission" | "recording" | "transcribing" | "attaching";
interface ActiveRecording {
  recorder: MicrophoneRecorder;
  kind: RecordingKind;
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
  const [adding, setAdding] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const attachMenu = useRef<HTMLDivElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle");
  const [recordingKind, setRecordingKind] = useState<RecordingKind | null>(null);
  const [supportsRecording] = useState(microphoneSupported);
  const inputId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const previousSong = useRef(songId);
  const currentSong = useRef(songId);
  const recording = useRef<ActiveRecording | null>(null);
  const recordingEpoch = useRef(0);
  const mounted = useRef(true);
  currentSong.current = songId;

  const cancelRecording = useCallback(() => {
    recordingEpoch.current++;
    const active = recording.current;
    recording.current = null;
    active?.controller.abort();
    active?.recorder.cancel();
    if (mounted.current) { setRecordingPhase("idle"); setRecordingKind(null); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelRecording(); };
  }, [cancelRecording]);

  useEffect(() => {
    if (previousSong.current !== null && songId !== previousSong.current) {
      cancelRecording();
    }
    previousSong.current = songId;
  }, [songId, cancelRecording]);

  useEffect(() => { void client.composer.open(songId); }, [client, songId]);

  useEffect(() => {
    // The field starts disabled while its saved draft loads, so mount-time autofocus cannot reach it.
    if (composer.loaded && composer.songId === songId && document.activeElement === document.body) field.current?.focus();
  }, [composer.loaded, composer.songId, songId]);

  useEffect(() => {
    if (recordingPhase === "idle" || recordingPhase === "attaching") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelRecording();
      field.current?.focus();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [recordingPhase, cancelRecording]);

  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = "auto";
    field.current.style.height = `${Math.min(field.current.scrollHeight, 180)}px`;
  }, [text]);

  const isCurrentRecording = (active: ActiveRecording) => mounted.current && recording.current === active &&
    recordingEpoch.current === active.epoch && currentSong.current === active.songId && !active.controller.signal.aborted;

  const finishRecording = async () => {
    const active = recording.current;
    if (!active || active.finishing) return;
    active.finishing = true;
    setRecordingPhase(active.kind === "audio" ? "attaching" : "transcribing");
    try {
      const file = await active.recorder.finish();
      if (!isCurrentRecording(active)) return;
      if (active.kind === "audio") {
        // The saved reference supplies the actual waveform to the main agent when Send is pressed.
        await client.attachReferences(selectedReferences([file]), active.songId);
      } else {
        const result = await client.api.transcribe(file, active.songId, active.controller.signal);
        if (!isCurrentRecording(active)) return;
        if (result.songId !== active.songId) throw new Error(t("chat.dictationSongChanged"));
        const transcript = result.text.trim();
        if (!transcript) throw new Error(t("chat.dictationEmpty"));
        // Functional append preserves edits made while permission, recording or transcription was pending.
        client.composer.appendText(transcript);
      }
    } catch (error) {
      if (isCurrentRecording(active)) client.store.setError(t(active.kind === "audio" ? "chat.audioRecordingStopped" : "chat.dictationStopped", { error: errorMessage(error) }));
    } finally {
      active.recorder.cancel();
      if (recording.current === active) {
        recording.current = null;
        if (mounted.current) { setRecordingPhase("idle"); setRecordingKind(null); field.current?.focus(); }
      }
    }
  };

  const startRecording = async (kind: RecordingKind) => {
    const intendedSong = currentSong.current;
    if (recording.current || !intendedSong || !composer.loaded || composer.songId !== intendedSong ||
      (kind === "dictation" && !dictationReady) || !supportsRecording || sending || adding) return;
    const active: ActiveRecording = {
      kind,
      songId: intendedSong,
      epoch: ++recordingEpoch.current,
      controller: new AbortController(),
      finishing: false,
      recorder: new MicrophoneRecorder(() => { void finishRecording(); }, (error) => {
        if (!isCurrentRecording(active)) return;
        client.store.setError(errorMessage(error));
        cancelRecording();
      }, kind),
    };
    recording.current = active;
    setRecordingKind(kind);
    setRecordingPhase("permission");
    client.store.setError(null);
    try {
      await active.recorder.start();
      if (isCurrentRecording(active)) setRecordingPhase("recording");
      else active.recorder.cancel();
    } catch (error) {
      if (isCurrentRecording(active)) {
        client.store.setError(t(kind === "audio" ? "chat.audioRecordingStartFailed" : "chat.dictationStartFailed", { error: errorMessage(error) }));
        cancelRecording();
      }
    }
  };

  useEffect(() => {
    if (!addMenu) return;
    attachMenu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const outside = (event: PointerEvent) => { if (!attachMenu.current?.contains(event.target as Node)) setAddMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAddMenu(false); field.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [addMenu]);
  useEffect(() => { setAddMenu(false); setAdding(false); }, [songId]);

  const attach = async (selection: Promise<ReferenceSelection[]> | ReferenceSelection[]) => {
    const intendedSong = currentSong.current;
    if (!intendedSong || recording.current || adding || sending || !composer.loaded) return;
    setAddMenu(false); setAdding(true); client.store.setError(null);
    try { await client.attachReferences(await selection, intendedSong); }
    catch (error) { if (mounted.current && currentSong.current === intendedSong) client.store.setError(errorMessage(error)); }
    finally { if (mounted.current && currentSong.current === intendedSong) { setAdding(false); field.current?.focus(); } }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!text.trim() && attachments.length === 0) || sending || adding || recording.current) return;
    setSending(true);
    try {
      await client.sendDraft();
    } finally {
      setSending(false);
      field.current?.focus();
    }
  };

  const recordingDisabled = (kind: RecordingKind) => recordingPhase === "idle"
    ? !supportsRecording || !songId || !composer.loaded || composer.songId !== songId || sending || adding || (kind === "dictation" && !dictationReady)
    : recordingPhase !== "recording" || recordingKind !== kind;

  return (
    <form className="now__composer" onSubmit={(event) => void submit(event)}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDrop={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); void attach(droppedReferences(event.dataTransfer)); } }}
      onPaste={event => { const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/")); if (images.length) { event.preventDefault(); void attach(selectedReferences(images)); } }}>
      <ReferenceChips files={attachments} remove={id => client.composer.removeAttachment(id)} />
      <label htmlFor={inputId} className="ode-visually-hidden">{t("chat.messageLabel")}</label>
      <textarea ref={field} id={inputId} className="ode-input now__field" value={text} rows={2} disabled={!composer.loaded || composer.songId !== songId}
        placeholder={t("chat.messagePlaceholder")}
        autoComplete="off"
        onChange={(event) => client.composer.editText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} />
      <div className="now__composer-actions">
        <div className="now__attach" ref={attachMenu}>
          <IconButton icon={IconName.Plus} label={t("references.add")} aria-expanded={addMenu} aria-haspopup="menu" disabled={adding || sending || !composer.loaded || recordingPhase !== "idle"} onClick={() => setAddMenu(!addMenu)} />
          {addMenu && <div className="now__attach-menu" role="menu" aria-label={t("references.add")}>
            <Button variant={ButtonVariant.Quiet} role="menuitem" onClick={() => { setAddMenu(false); filesInput.current?.click(); }}>{t("references.files")}</Button>
            <Button variant={ButtonVariant.Quiet} role="menuitem" onClick={() => { setAddMenu(false); folderInput.current?.click(); }}>{t("references.folder")}</Button>
          </div>}
          <input hidden ref={filesInput} type="file" multiple accept={REFERENCE_ACCEPT} onChange={event => { const selected = selectedReferences(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; void attach(selected); }} />
          <input hidden ref={folderInput} type="file" multiple {...{ webkitdirectory: "" }} onChange={event => { const selected = selectedReferences(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; void attach(selected); }} />
        </div>
        {adding && <span className="small muted" role="status">{t("references.adding")}</span>}
        <IconButton icon={recordingKind === "audio" && recordingPhase === "recording" ? IconName.Stop : IconName.Music}
          className="now__voice" disabled={recordingDisabled("audio")}
          aria-pressed={recordingKind === "audio" && recordingPhase === "recording"}
          aria-busy={recordingKind === "audio" && (recordingPhase === "permission" || recordingPhase === "attaching")}
          label={recordingKind === "audio" && recordingPhase === "recording" ? t("chat.finishAudioRecording") : t("chat.recordAudio")}
          title={!supportsRecording ? t("chat.microphoneUnavailable") : recordingKind === "audio" && recordingPhase === "recording" ? t("chat.finishAudioRecording") : t("chat.recordAudio")}
          onClick={() => { if (recordingKind === "audio" && recordingPhase === "recording") void finishRecording(); else void startRecording("audio"); }} />
        <IconButton icon={recordingKind === "dictation" && recordingPhase === "recording" ? IconName.Stop : IconName.Microphone}
          className="now__voice"
          disabled={recordingDisabled("dictation")}
          aria-pressed={recordingKind === "dictation" && recordingPhase === "recording"}
          aria-busy={recordingKind === "dictation" && (recordingPhase === "permission" || recordingPhase === "transcribing")}
          label={recordingKind === "dictation" && recordingPhase === "recording" ? t("chat.finishDictation") : t("chat.dictateMessage")}
          title={!supportsRecording ? t("chat.microphoneUnavailable") : !dictationReady ? t("chat.dictationSetup") : recordingKind === "dictation" && recordingPhase === "recording" ? t("chat.finishDictation") : t("chat.dictateMessage")}
          onClick={() => { if (recordingKind === "dictation" && recordingPhase === "recording") void finishRecording(); else void startRecording("dictation"); }} />
        {recordingPhase !== "idle" && recordingPhase !== "attaching" && <IconButton icon={IconName.Close} label={t(recordingKind === "audio" ? "chat.cancelAudioRecording" : "chat.cancelDictation")} onClick={() => { cancelRecording(); field.current?.focus(); }} />}
        {((busy && stoppable) || sending || composer.pending) && <IconButton icon={IconName.Stop} label={t("chat.stop")} onClick={() => { cancelRecording(); void client.stopRequest(); }} />}
        <IconButton type="submit" className="now__send" icon={IconName.Send} label={t("chat.send")} aria-busy={sending}
          disabled={sending || adding || !composer.loaded || !composer.valid || composer.conflicts.length > 0 || recordingPhase !== "idle" || (!text.trim() && attachments.length === 0)} />
      </div>
      {composer.error && <p className="small" role="status">{composer.error} {composer.conflicts.length === 0 && <Button variant={ButtonVariant.Quiet} onClick={() => { void (composer.loaded ? client.composer.flush() : client.composer.open(songId, true)); }}>{t("common.retry")}</Button>}</p>}
      {composer.conflicts.length > 0 && <p className="small" role="status">{t("chat.draftConflict")} <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("local").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>{t("chat.keepDraft")}</Button> <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("saved").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>{t("chat.useSavedDraft")}</Button></p>}
      {recordingPhase !== "idle" && <p className="small muted" role="status">{recordingPhase === "permission" ? t("chat.microphonePermission") : recordingPhase === "recording" ? t("chat.recording") : recordingPhase === "attaching" ? t("chat.attachingRecording") : t("chat.transcribing")}</p>}
    </form>
  );
}
