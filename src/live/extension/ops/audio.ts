import { AudioTrack } from "@ableton-extensions/sdk";
import { LiveError } from "../errors";
import { OperationGroup } from "./group";
import { type OpArgs, type OpRun, type OperationTable } from "./operation";

type AudioOp = "render_track_audio" | "import_into_project";

/** Audio files: rendering a track, and bringing a file into the Live project. */
export class AudioOperations extends OperationGroup<AudioOp> {
  table(): OperationTable<AudioOp> {
    return {
      render_track_audio: { prepare: (args) => this.render(args) },
      import_into_project: { prepare: (args) => this.importFile(args) },
    };
  }

  /** Renders an Arrangement audio track before its effects; the file goes to the extension's temporary folder. */
  private render({ track, start, end }: OpArgs<"render_track_audio">): OpRun<"render_track_audio"> {
    const target = this.refs.track(track);
    if (!(target instanceof AudioTrack) || this.set.tracks().position(target).kind !== "audio") {
      throw new Error("render_track_audio needs an Arrangement audio track");
    }
    OperationGroup.checkRange(start, end);
    return async () => ({
      path: await LiveError.guard(this.live.resources.renderPreFxAudio(target, start, end), "render the track"),
    });
  }

  /** Brings a file into the Live project's folder; from then on, use the path this returns. */
  private importFile({ filePath }: OpArgs<"import_into_project">): OpRun<"import_into_project"> {
    OperationGroup.checkFile(filePath);
    return async () => ({ path: await LiveError.guard(this.live.resources.importIntoProject(filePath), "import the file") });
  }
}
