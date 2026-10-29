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

/** Every Live operation except grouping itself and reading the whole Set (project_map_get does that). */
const GROUPABLE_OPS = EXTENSION_OPS.filter((op) => op !== "apply_as_one_undo_step" && op !== "set_snapshot");

/** Runs several Live changes as one undo step; each step is checked against its own tool's inputs. */
const applyAsOneUndoStep = defineTool({
  name: "apply_as_one_undo_step",
  changes: "set",
  description:
    "Run several Live operations as one undo step, so the musician can undo the whole change at once (for example: write notes into three clips, set four mixer levels, rename the locators). Each call is { op, args } where op is one of the Live tool names and args are that tool's inputs. Every reference is looked up before anything changes, so each call refers to what exists before the group runs: create new tracks or clips first, then group the edits. A group that creates objects takes two undo entries in Live, one for the new objects and one for their names and notes. Results come back in order.",
  input: {
    calls: z
      .array(z.object({ op: z.enum(GROUPABLE_OPS), args: z.record(z.string(), z.unknown()) }))
      .min(1),
  },
  describe: ({ calls }, names) =>
    calls
      .map((call) => {
        const definition = byName.get(call.op);
        const args = definition ? z.object(definition.input).safeParse(call.args) : undefined;
        return args?.success ? (definition?.describe?.(args.data, names) ?? call.op) : call.op;
      })
      .join("; "),
  run: async ({ calls }, ctx) => {
    const checked = calls.map((call, index) => {
      const definition = byName.get(call.op);
      if (!definition) throw new Error(`call ${index + 1}: ${call.op} runs on its own, outside a group`);
      const args = z.object(definition.input).safeParse(call.args);
      if (!args.success) throw new Error(`call ${index + 1} (${call.op}): ${z.prettifyError(args.error)}`);
      return { op: call.op, args: args.data };
    });
    return ctx.live.extension.call("apply_as_one_undo_step", { calls: checked });
  },
});

export const liveTools: AnyTool[] = [...operationTools, applyAsOneUndoStep];
