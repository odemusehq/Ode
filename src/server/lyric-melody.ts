import { z } from "zod";
import { t } from "../shared/i18n";
import { LyricsMelodyEditSchema, type LyricsMelodyEdit } from "../shared/lyrics-document";
import { NoteSchema } from "../shared/live-schemas";
import type { LiveConnections } from "../shared/live";
import type { ExtensionOpResults } from "../shared/live-ops";
import type { LyricsState } from "../shared/lyrics";
import type { SongStore } from "../mneme/song-store";
import type { LyricsStore } from "../mneme/lyrics-store";
import { markPendingObservation, pendingObservationFile } from "../mneme/pending-observation";
import type { SessionManager } from "../harness/session-manager";
import type { VersionRecorder } from "./version-recorder";

interface Deps { song: SongStore; lyrics: LyricsStore; live: LiveConnections; sessions: SessionManager; recorder: VersionRecorder }

/** The lyric editor uses the existing native guarded MIDI writer and the musician's History path. */
export class LyricMelody {
  constructor(private readonly deps: Deps) {}

  async edit(input: LyricsMelodyEdit): Promise<{ lyrics: LyricsState; warning?: string }> {
    const edit = LyricsMelodyEditSchema.parse(input);
    return this.deps.sessions.current.exclusive(async stopped => {
      const { song, lyrics, live, recorder } = this.deps;
      if (song.songId !== edit.songId) throw new Error(t("lyrics.document.annotationsSongChanged"));
      const dir = song.dataDir;
      await recorder.recoverPending(dir);
      await recorder.handEdits();
      stopped.throwIfAborted();
      let issued = false;
      try {
        const saved = await lyrics.editMelody(edit, async (clip, wanted) => {
          const read = await live.extension.call<ExtensionOpResults["midi_clip_get_notes"]>("midi_clip_get_notes", { clip: clip.clip }, stopped);
          const current = z.array(NoteSchema).parse(read.notes);
          if (JSON.stringify(current) !== JSON.stringify(clip.notes)) throw new Error(t("lyrics.document.midiChanged"));
          if (!read.guardedRecovery || !read.recoveryToken) throw new Error(t("lyrics.document.noteGuardUnavailable"));
          stopped.throwIfAborted();
          await markPendingObservation(dir, [t("lyrics.document.noteEditHistory")]);
          stopped.throwIfAborted();
          issued = true;
          // Once issued, finish observing and persisting the result even if Stop is pressed.
          const result = await live.extension.call<ExtensionOpResults["midi_clip_set_notes"]>("midi_clip_set_notes", {
            clip: clip.clip, notes: [...wanted].sort((a, b) => a.start - b.start || a.pitch - b.pitch), expected: { token: read.recoveryToken, notes: current },
          });
          const receipt = result.__odeReceipts?.find(receipt => receipt.kind === "midi-notes");
          const actual = receipt?.kind === "midi-notes" ? receipt.after : (await live.extension.call<ExtensionOpResults["midi_clip_get_notes"]>("midi_clip_get_notes", { clip: clip.clip })).notes;
          return z.array(NoteSchema).parse(actual);
        });
        try {
          await recorder.handEdits();
          await pendingObservationFile(dir).write(null);
        } catch (error) {
          return { lyrics: saved.lyrics, warning: t("lyrics.document.noteHistoryUnavailable", { reason: error instanceof Error ? error.message : String(error) }) };
        }
        return { lyrics: saved.lyrics, ...(!saved.aligned ? { warning: t("lyrics.document.alignmentStale") } : {}) };
      } catch (error) {
        // Refresh after a source conflict or uncertain write; never undo later native edits automatically.
        try {
          if (song.songId === edit.songId) {
            await lyrics.refreshMelody(async clip => (await live.extension.call<ExtensionOpResults["midi_clip_get_notes"]>("midi_clip_get_notes", { clip })).notes);
            if (!issued) await pendingObservationFile(dir).write(null);
          }
        } catch { /* The durable observation remains pending until Live is readable again. */ }
        if (issued) throw new Error(t("lyrics.document.noteEditInterrupted", { reason: error instanceof Error ? error.message : String(error) }));
        throw error;
      }
    });
  }
}
