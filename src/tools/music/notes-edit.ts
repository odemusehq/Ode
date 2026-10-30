import { t } from "../../shared/i18n";
import { editNotes, NoteEditsSchema } from "../../music/parts/note-editor";
import { defineTool } from "../define";
import { NoteSchema } from "../live/schemas";

export const notesEditTool = defineTool({
  name: "notes_edit",
  description: [
    "Draft note changes precisely without rewriting an entire clip by hand. This pure helper leaves Live and the source material unchanged.",
    "Give the complete notes, inline or as an exact MIDI material reference. updates contains {index,set?,clear?}; remove contains original indices; add contains complete new notes. Each list has at most 512 entries.",
    "Every index addresses the ORIGINAL supplied note order, as shown by midi_material_read note pages, and all operations happen together. Surviving notes keep their order and every omitted field, including mute, probability zero and expressive off-grid timing; new notes are appended without sorting. No quantisation, clipping or defaults are applied.",
    "set accepts supported note fields with their ordinary strict ranges. clear may only name velocity, muted, probability, velocityDeviation or releaseVelocity, and means omit that optional field, not guess a replacement/default. Undefined is not a clearing operation. Duplicate/out-of-range indices, updating and removing the same note, duplicate clears and setting/clearing the same field are refused atomically.",
    "Returns complete notes plus sourceToOutput (original index to new index, null when removed), updatedSourceIndices (actually changed), removedSourceIndices and addedOutputIndices. This map addresses only the returned material order, not stable Live note IDs: a later native read sorts notes by start/pitch, so reread before selecting indices after applying. Old lyric alignment is not copied or certified: remap it deliberately with sourceToOutput or recheck the setting after timing/count changes.",
    "Apply the complete result with the existing guarded MIDI writer. Source read lineage survives the reference, so a fresh read token cannot bless an unreconciled stale edit. The main agent applies Set changes through the usual Manual/lock checks; read-only children may draft this result.",
  ].join(" "),
  input: { notes: NoteSchema.strict().array(), ...NoteEditsSchema.shape },
  changes: "none",
  describe: () => t("toolActivity.draftNoteChanges"),
  async run({ notes, updates, remove, add }) {
    return editNotes(notes, { updates, remove, add });
  },
});
