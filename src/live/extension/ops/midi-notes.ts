import { fromLiveNotes, toLiveNotes } from "../notes";
import { OperationGroup } from "./group";
import { OperationKind, type OpArgs, type OpRun, type OperationTable } from "./operation";

type MidiNoteOp = "midi_clip_get_notes" | "midi_clip_set_notes";

/** The notes of MIDI clips, in beats from the clip start. */
export class MidiNoteOperations extends OperationGroup<MidiNoteOp> {
  table(): OperationTable<MidiNoteOp> {
    return {
      midi_clip_get_notes: { kind: OperationKind.Read, prepare: (args) => this.getNotes(args) },
      midi_clip_set_notes: { kind: OperationKind.Change, prepare: (args) => this.setNotes(args) },
    };
  }

  private getNotes({ clip }: OpArgs<"midi_clip_get_notes">): OpRun<"midi_clip_get_notes"> {
    const target = this.refs.midiClip(clip).clip;
    return async () => ({ notes: fromLiveNotes(target.notes) });
  }

  /** Replaces every note in the clip. */
  private setNotes({ clip, notes }: OpArgs<"midi_clip_set_notes">): OpRun<"midi_clip_set_notes"> {
    const target = this.refs.midiClip(clip).clip;
    const liveNotes = toLiveNotes(notes);
    return async () => {
      target.notes = liveNotes;
      return { count: liveNotes.length };
    };
  }
}
