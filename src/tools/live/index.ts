import { z } from "zod";
import { EXTENSION_OPS } from "../../shared/live";
import { defineTool, type AnyTool } from "../define";
import { clipSlotTools, clipTools, takeLaneTools } from "./clips";
import { deviceTools, rackTools } from "./devices";
import { audioFileTools, sceneTools } from "./scenes-audio";
import { songTools } from "./song";
import { trackTools } from "./tracks";

const operationTools: AnyTool[] = [
  ...songTools,
  ...trackTools,
  ...takeLaneTools,
  ...clipSlotTools,
  ...clipTools,
  ...deviceTools,
  ...rackTools,
  ...sceneTools,
  ...audioFileTools,
];

const byName = new Map(operationTools.map((definition) => [definition.name, definition]));

const GROUPABLE_OPS = EXTENSION_OPS.filter((op) => op !== "apply_as_one_undo_step");

/** Runs several Live changes as one undo step; each step is checked against its own tool's inputs. */
const applyAsOneUndoStep = defineTool({
  name: "apply_as_one_undo_step",
  changes: "set",
  description:
    "Run several Live operations as one undo step, so the musician can undo the whole change at once (for example: create a track, create a clip with notes, rename a locator). Each call is { op, args } where op is one of the Live tool names and args are that tool's inputs. Results come back in order.",
  input: {
    calls: z
      .array(z.object({ op: z.enum(GROUPABLE_OPS), args: z.record(z.string(), z.unknown()) }))
      .min(1),
  },
  describe: ({ calls }) =>
    calls
      .map((call) => {
        const definition = byName.get(call.op);
        return definition?.describe?.(call.args as never) ?? call.op;
      })
      .join(" "),
  run: async ({ calls }, ctx) => {
    const checked = calls.map((call) => {
      const definition = byName.get(call.op);
      if (!definition) throw new Error(`${call.op} can't be grouped`);
      return { op: call.op, args: z.object(definition.input).parse(call.args) };
    });
    return ctx.live.extension.call("apply_as_one_undo_step", { calls: checked });
  },
});

export const liveTools: AnyTool[] = [...operationTools, applyAsOneUndoStep];
