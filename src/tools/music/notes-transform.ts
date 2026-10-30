import { t } from "../../shared/i18n";
import { NoteTransformSchema, transformNotes } from "../../music/parts/note-transformer";
import { defineTool } from "../define";
import { NoteSchema } from "../live/schemas";

export const notesTransformTool = defineTool({
  name: "notes_transform",
  description: [
    "Draft a uniform change to a whole complete MIDI part without listing every note. Give notes inline or as an exact MIDI material reference.",
    "transposeSemitones is an integer pitch change (default 0); timeScale is a positive timing multiplier (default 1); timeOffsetBeats is a signed shift of local note starts (default 0). The fixed anchor is CLIP-LOCAL BEAT ZERO: newStart = oldStart * timeScale + timeOffsetBeats, newDuration = oldDuration * timeScale. Offset does not alter durations. No first-note anchor, tempo, key or Arrangement placement is inferred.",
    "Every supplied note is transformed, including muted and probability-zero notes. Order, velocities, probability, deviation, release velocity and all other omitted supported fields stay unchanged. No quantisation, pitch snapping, rounding or clamping is applied. Empty material, unchanged output, nonfinite results, pitches outside MIDI 0–127, negative starts or nonpositive durations refuse the whole proposal.",
    "Returns complete notes, the exact transformation scalars with anchorBeat:0, and noteEndBeats. That is only the last note end, not the phrase/loop length: read source clip metadata when preserving or scaling intended trailing rests and choose destination length separately. This helper never changes markers, adds repeats or places clips. For an unchanged copy at another Arrangement position, use the existing clip creation tool with the original exact reference and an explicit start/length.",
    "Indices correspond one-for-one to this supplied material order, not stable Live note IDs. No old lyric alignment is copied or rechecked; revisit it after changing pitch/timing as appropriate. Source read lineage survives the complete output reference, so ordinary guarded MIDI replacement still refuses an unreconciled stale edit. This is a pure read-only draft; the main agent applies it through the existing approval/lock/native guards.",
  ].join(" "),
  input: {
    notes: NoteSchema.strict().array().min(1),
    transposeSemitones: NoteTransformSchema.shape.transposeSemitones.unwrap().optional(),
    timeScale: NoteTransformSchema.shape.timeScale.unwrap().optional(),
    timeOffsetBeats: NoteTransformSchema.shape.timeOffsetBeats.unwrap().optional(),
  },
  changes: "none",
  describe: ({ transposeSemitones = 0, timeScale = 1, timeOffsetBeats = 0 }) => {
    const actions = [
      transposeSemitones === 0 ? "" : t("toolActivity.transposeNotes", { isTransposeSemitones: Boolean(transposeSemitones > 0), transposeSemitones: transposeSemitones }),
      timeScale === 1 ? "" : t("toolActivity.timing", { timeScale: timeScale }),
      timeOffsetBeats === 0 ? "" : t("toolActivity.shiftNotes", { isTimeOffsetBeats: Boolean(timeOffsetBeats > 0), timeOffsetBeats: timeOffsetBeats }),
    ].filter(Boolean);
    return t("toolActivity.draft", { value: actions.join(" · ") || "note transform" });
  },
  async run({ notes, transposeSemitones, timeScale, timeOffsetBeats }) {
    return transformNotes(notes, { transposeSemitones, timeScale, timeOffsetBeats });
  },
});
