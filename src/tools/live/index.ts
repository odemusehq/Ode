import { z } from "zod";
import { EXTENSION_OPS } from "../../shared/live";
import { defineTool, type AnyTool } from "../define";
import { clipSlotTools, clipTools, takeLaneTools } from "./clips";
import { deviceTools, rackTools } from "./devices";
import { audioFileTools, sceneTools } from "./scenes-audio";
import { songTools } from "./song";
import { trackTools } from "./tracks";
import { localAudioTools } from "./local-audio";

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

/** Every Live operation that can go in a group; grouping itself and reading the whole Set (project_map_get does that) stay out. */
const GROUPABLE_OPS = EXTENSION_OPS.filter((op) => op !== "apply_as_one_undo_step" && op !== "set_snapshot");

/** Groups checked operations; creation and its later setup occupy separate native undo entries. */
const applyAsOneUndoStep = defineTool({
  name: "apply_as_one_undo_step",
  changes: "set",
  description:
    "Batch Live operations. Existing-object edits can share one native Live undo entry (for example: replace notes in three existing clips, set four mixer levels, rename locators). Creation followed by naming or notes uses two native transactions; the historical tool name does not promise one Undo press for that case. Returns results in call order and nativeTransactions; Live owns its actual undo history, including no-op edits. Each call is { op, args } using Live tool inputs. References are resolved before the batch, so create needed objects first, then group their edits. Native Live Undo and Ode's snapshot reconstruction are separate mechanisms.",
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

export const liveTools: AnyTool[] = [...operationTools, applyAsOneUndoStep, ...localAudioTools];
