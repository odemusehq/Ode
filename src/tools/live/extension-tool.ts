import type { z } from "zod";
import type { ExtensionOp } from "../../shared/live";
import { defineTool, type OdeTool, type ToolChange } from "../define";
import type { RefNames } from "./ref-names";

interface ExtensionToolSpec<S extends z.ZodRawShape> {
  op: ExtensionOp;
  description: string;
  input: S;
  changes?: ToolChange;
  describe?: (input: z.infer<z.ZodObject<S>>, names: RefNames) => string;
  alwaysLoad?: boolean;
}

/** A tool that runs one Extensions SDK operation in Live through the Ode extension. */
export function extensionTool<S extends z.ZodRawShape>(spec: ExtensionToolSpec<S>): OdeTool<S> {
  return defineTool({
    name: spec.op,
    description: spec.description,
    input: spec.input,
    changes: spec.changes ?? "none",
    describe: spec.describe,
    alwaysLoad: spec.alwaysLoad,
    run: (input, ctx) => ctx.live.extension.call(spec.op, input),
  });
}
