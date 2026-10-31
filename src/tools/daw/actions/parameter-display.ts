import { z } from "zod";
import { t } from "../../../shared/i18n";
import { defineTool, type AnyTool } from "../../define";
import { target } from "../parameter-target";
import { ParameterRefSchema } from "../schemas";
export const parameterDisplayWrites: AnyTool[] = [
  defineTool({
    name: "parameter_set_display",
    changes: "set",
    description: "Set a device or mixer control in its actual native numeric display units through Max's DeviceParameter.display_value. First parameter_read_display on this exact parameter to learn its units and get readToken. For example use 1200 only when the native display established Hz, or -6 when it established dB; do not guess units from a raw 0–1 range. Returns native before/after values and formatted text; inspect actual readback, which can be rounded or limited by the host. Refuses changed/replaced targets, stale raw values, disabled or unsupported controls and expired tokens. Active automation needs explicit artist intent and allowAutomationOverride=true. This sets a control, not an automation envelope, analyser or custom unit conversion.",
    input: { parameter: ParameterRefSchema, readToken: z.string().min(1), value: z.number(),
      allowAutomationOverride: z.boolean().optional().describe("Only true when the musician intends to override this parameter's active automation.") },
    describe: ({ parameter }, names) => t("toolActivity.adjustParameter", { parameter: names.parameter(parameter) }),
    run: async ({ parameter, readToken, value, allowAutomationOverride }, ctx) => {
      const found = await target(parameter, ctx);
      return found.native.set(found.address, found.scope, readToken, value, allowAutomationOverride ?? false, ctx.signal);
    },
  })
];
