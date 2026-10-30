import { fromLiveNotes, toLiveNotes } from "../notes";
import { createHash } from "node:crypto";
import type { Note } from "../../../shared/live";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type MidiNoteOp = "midi_clip_get_notes" | "midi_clip_set_notes";

/** The notes of MIDI clips, in beats from the clip start. */
export class MidiNoteOperations extends OperationGroup<MidiNoteOp> {
  /** Receipts bind to native object handles in this extension lifetime, not reusable list positions. */
  private readonly targets = new Map<string, { handleId: string; notesHash: string }>();
  private static readonly MAX_TARGETS = 4096;
  private receiptNumber = 0;
  private readonly lifetime = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  table(): OperationTable<MidiNoteOp> {
    return {
      midi_clip_get_notes: { prepare: (args) => this.getNotes(args) },
      midi_clip_set_notes: { prepare: (args) => this.setNotes(args) },
    };
  }

  private getNotes({ clip, recoveryToken }: OpArgs<"midi_clip_get_notes">): OpRun<"midi_clip_get_notes"> {
    const target = this.refs.midiClip(clip).clip;
    return async () => {
      if (recoveryToken) {
        const recovered = this.targets.get(recoveryToken);
        if (!recovered || recovered.handleId !== String(target.handle.id)) throw new Error("That MIDI recovery receipt expired or belongs to an earlier Live session or another clip; the notes were kept.");
        // Keep the receipt just validated for recovery when issuing this read at the bounded map's limit.
        this.targets.delete(recoveryToken);
        this.targets.set(recoveryToken, recovered);
      }
      const notes = fromLiveNotes(target.notes);
      return { notes, guardedRecovery: true, recoveryToken: this.remember(String(target.handle.id), notes) };
    };
  }

  /** Replaces every note in the clip. */
  private setNotes({ clip, notes, expected }: OpArgs<"midi_clip_set_notes">): OpRun<"midi_clip_set_notes"> {
    const target = this.refs.midiClip(clip).clip;
    const liveNotes = toLiveNotes(notes);
    return async () => {
      const before = fromLiveNotes(target.notes);
      const saved = expected && this.targets.get(expected.token);
      if (expected && (!saved || saved.handleId !== String(target.handle.id) || saved.notesHash !== MidiNoteOperations.hash(before) ||
        expected.notes !== undefined && JSON.stringify(before) !== JSON.stringify(expected.notes))) {
        throw new Error("The MIDI clip changed, its read token expired, it moved to another target, or Live restarted. Its notes were kept. Read the current notes and reconcile the edit before using a fresh token.");
      }
      // SDK note replacement is synchronous: observe, guard and replace without an intervening await.
      target.notes = liveNotes;
      if (expected) this.targets.delete(expected.token);
      const after = fromLiveNotes(target.notes);
      const token = this.remember(String(target.handle.id), after);
      return { count: liveNotes.length, __odeReceipts: [{ kind: "midi-notes", clip, token, before, after }] };
    };
  }

  private remember(handleId: string, notes: Note[]): string {
    const token = `${this.lifetime}/${++this.receiptNumber}`;
    this.targets.set(token, { handleId, notesHash: MidiNoteOperations.hash(notes) });
    while (this.targets.size > MidiNoteOperations.MAX_TARGETS) this.targets.delete(this.targets.keys().next().value!);
    return token;
  }

  private static hash(notes: Note[]): string {
    return createHash("sha256").update(JSON.stringify(notes)).digest("hex");
  }
}
