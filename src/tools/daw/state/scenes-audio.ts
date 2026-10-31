import { z } from "zod";
import { extensionTool } from "../extension-tool";
import { SceneRefSchema, TrackRefSchema } from "../schemas";

export const sceneTools = [
  extensionTool({
    op: "scene_get",
    description: "Read a scene: name, tempo and time signature.",
    input: { scene: SceneRefSchema },
  })
];

export const audioFileTools = [
  extensionTool({
    op: "render_track_audio",
    description:
      "Render an Arrangement audio track's sound before its effects, between two beats, to an audio file. Returns the file path, for analysis tools. Only audio tracks in the Arrangement can be rendered.",
    input: { track: TrackRefSchema, start: z.number().min(0), end: z.number().positive() },
  }),
  extensionTool({
    op: "import_into_project",
    description:
      "Copy an audio file (for example one Ode generated) into the Live project so Live manages it. Returns the new path; use that path when creating clips or loading samples.",
    input: { filePath: z.string().min(1) },
  })
];
