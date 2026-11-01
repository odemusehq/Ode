import { t } from "../../shared/i18n";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { Button, ButtonVariant, IconButton, IconName } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";
import { REFERENCE_ACCEPT, selectedReferences, droppedReferences, type ReferenceSelection } from "../app/references";
import { ReferenceChips } from "./ReferenceChips";
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
  const [adding, setAdding] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const attachMenu = useRef<HTMLDivElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
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
    // The field starts disabled while its saved draft loads, so mount-time autofocus cannot reach it.
    if (composer.loaded && composer.songId === songId && document.activeElement === document.body) field.current?.focus();
  }, [composer.loaded, composer.songId, songId]);

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
      if (result.songId !== active.songId) throw new Error(t("chat.dictationSongChanged"));
      const transcript = result.text.trim();
      if (!transcript) throw new Error(t("chat.dictationEmpty"));
      // Functional append preserves edits made while permission, recording or transcription was pending.
      client.composer.appendText(transcript);
    } catch (error) {
      if (isCurrentDictation(active)) client.store.setError(t("chat.dictationStopped", { error: (errorMessage(error)) }));
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
    if (voice.current || !intendedSong || !composer.loaded || !dictationReady || !supportsDictation || sending) return;
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
        client.store.setError(t("chat.dictationStartFailed", { error: (errorMessage(error)) }));
        cancelDictation();
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
    if (!intendedSong || adding || sending || !composer.loaded) return;
    setAddMenu(false); setAdding(true); client.store.setError(null);
    try { await client.attachReferences(await selection, intendedSong); }
    catch (error) { if (mounted.current && currentSong.current === intendedSong) client.store.setError(errorMessage(error)); }
    finally { if (mounted.current && currentSong.current === intendedSong) { setAdding(false); field.current?.focus(); } }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!text.trim() && attachments.length === 0) || sending || adding || voice.current) return;
    setSending(true);
    try {
      await client.sendDraft();
    } finally {
      setSending(false);
      field.current?.focus();
    }
  };

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
          <IconButton icon={IconName.Plus} label={t("references.add")} aria-expanded={addMenu} aria-haspopup="menu" disabled={adding || sending || !composer.loaded} onClick={() => setAddMenu(!addMenu)} />
          {addMenu && <div className="now__attach-menu" role="menu" aria-label={t("references.add")}>
            <Button variant={ButtonVariant.Quiet} role="menuitem" onClick={() => { setAddMenu(false); filesInput.current?.click(); }}>{t("references.files")}</Button>
            <Button variant={ButtonVariant.Quiet} role="menuitem" onClick={() => { setAddMenu(false); folderInput.current?.click(); }}>{t("references.folder")}</Button>
          </div>}
          <input hidden ref={filesInput} type="file" multiple accept={REFERENCE_ACCEPT} onChange={event => { const selected = selectedReferences(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; void attach(selected); }} />
          <input hidden ref={folderInput} type="file" multiple {...{ webkitdirectory: "" }} onChange={event => { const selected = selectedReferences(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; void attach(selected); }} />
        </div>
        {adding && <span className="small muted" role="status">{t("references.adding")}</span>}
        <IconButton icon={voicePhase === "recording" ? IconName.Stop : IconName.Microphone}
          className="now__voice"
          disabled={voicePhase === "permission" || voicePhase === "transcribing" || (voicePhase === "idle" && (!supportsDictation || !dictationReady || !songId || !composer.loaded || sending))}
          aria-pressed={voicePhase === "recording"} aria-busy={voicePhase === "permission" || voicePhase === "transcribing"}
          label={voicePhase === "recording" ? t("chat.finishDictation") : t("chat.dictateMessage")}
          title={!supportsDictation ? t("chat.microphoneUnavailable") : !dictationReady ? t("chat.dictationSetup") : voicePhase === "recording" ? t("chat.finishDictation") : t("chat.dictateMessage")}
          onClick={() => { if (voicePhase === "recording") void finishDictation(); else void startDictation(); }} />
        {voicePhase !== "idle" && <IconButton icon={IconName.Close} label={t("chat.cancelDictation")} onClick={() => { cancelDictation(); field.current?.focus(); }} />}
        {((busy && stoppable) || sending || composer.pending) && <IconButton icon={IconName.Stop} label={t("chat.stop")} onClick={() => { cancelDictation(); void client.stopRequest(); }} />}
        <IconButton type="submit" className="now__send" icon={IconName.Send} label={t("chat.send")} aria-busy={sending}
          disabled={sending || adding || !composer.loaded || !composer.valid || composer.conflicts.length > 0 || voicePhase !== "idle" || (!text.trim() && attachments.length === 0)} />
      </div>
      {composer.error && <p className="small" role="status">{composer.error} {composer.conflicts.length === 0 && <Button variant={ButtonVariant.Quiet} onClick={() => { void (composer.loaded ? client.composer.flush() : client.composer.open(songId, true)); }}>{t("common.retry")}</Button>}</p>}
      {composer.conflicts.length > 0 && <p className="small" role="status">{t("chat.draftConflict")} <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("local").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>{t("chat.keepDraft")}</Button> <Button variant={ButtonVariant.Quiet} disabled={composer.saving} onClick={() => { void client.composer.resolve("saved").catch((error: unknown) => client.store.setError(errorMessage(error))); }}>{t("chat.useSavedDraft")}</Button></p>}
      {voicePhase !== "idle" && <p className="small muted" role="status">{voicePhase === "permission" ? t("chat.microphonePermission") : voicePhase === "recording" ? t("chat.recording") : t("chat.transcribing")}</p>}
    </form>
  );
}
