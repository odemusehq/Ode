import { fromLiveNotes, toLiveNotes } from "../notes";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type MidiNoteOp = "midi_clip_get_notes" | "midi_clip_set_notes";

/** The notes of MIDI clips, in beats from the clip start. */
export class MidiNoteOperations extends OperationGroup<MidiNoteOp> {
  /** Receipts bind to native object handles in this extension lifetime, not reusable list positions. */
  private readonly targets = new Map<string, string>();
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
      if (recoveryToken && this.targets.get(recoveryToken) !== String(target.handle.id)) throw new Error("That MIDI recovery receipt belongs to an earlier Live session or another clip; the notes were kept.");
      const token = `${this.lifetime}/${++this.receiptNumber}`;
      this.targets.set(token, String(target.handle.id));
      return { notes: fromLiveNotes(target.notes), guardedRecovery: true, recoveryToken: token };
    };
  }

  /** Replaces every note in the clip. */
  private setNotes({ clip, notes, expected }: OpArgs<"midi_clip_set_notes">): OpRun<"midi_clip_set_notes"> {
    const target = this.refs.midiClip(clip).clip;
    const liveNotes = toLiveNotes(notes);
    return async () => {
      const before = fromLiveNotes(target.notes);
      if (expected && (this.targets.get(expected.token) !== String(target.handle.id) || JSON.stringify(before) !== JSON.stringify(expected.notes))) {
        throw new Error("The MIDI clip changed, moved to another target, or Live restarted since that change. Its notes were kept.");
      }
      // SDK note replacement is synchronous: observe, guard and replace without an intervening await.
      target.notes = liveNotes;
      if (expected) this.targets.delete(expected.token);
      const after = fromLiveNotes(target.notes);
      const token = `${this.lifetime}/${++this.receiptNumber}`;
      this.targets.set(token, String(target.handle.id));
      return { count: liveNotes.length, __odeReceipts: [{ kind: "midi-notes", clip, token, before, after }] };
    };
  }
}
