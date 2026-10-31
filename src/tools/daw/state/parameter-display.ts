import { defineTool, type AnyTool } from "../../define";
import { target } from "../parameter-target";
import { ParameterRefSchema } from "../schemas";
export const parameterDisplayReads: AnyTool[] = [
  defineTool({
    name: "parameter_read_display",
    changes: "none",
    description: "Read a device or mixer parameter through the paired Max device: actual numeric displayValue, formattedValue (Hz, kHz, dB, ms or the device's own text), rawValue, isEnabled, state and automationState. Use this for tuning instruments, EQ, compression, amp/effects and mixer levels in native units rather than guessing a nonlinear raw-value curve. Uses the same parameter reference as parameter_get. Returns a request-scoped token for parameter_set_display. Missing native display/state properties stay null; unsupported physical-unit writes have no local fallback. This does not measure audio, gain reduction or the sound of a preset.",
    input: { parameter: ParameterRefSchema },
    run: async ({ parameter }, ctx) => {
      const found = await target(parameter, ctx);
      return found.native.read(found.address, found.scope, ctx.signal);
    },
  })
];
