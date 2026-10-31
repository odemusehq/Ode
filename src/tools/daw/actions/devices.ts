import { basename } from "node:path";
import { z } from "zod";
import { t } from "../../../shared/i18n";
import { noteName } from "../../../shared/notes";
import { extensionTool } from "../extension-tool";
import { DeviceRefSchema, ParameterRefSchema } from "../schemas";

export const deviceTools = [
  extensionTool({
    op: "parameter_set",
    changes: "set",
    description:
      "Set a device parameter, or a mixer level (device index -1: parameter 0 volume, 1 pan, 2+ sends). Values are in the parameter's own range (see parameter_get); switches and choosers take the index of the option. Continuous 0–1 controls can be nonlinear: min/max alone do not establish a mapping to dB, Hz or time. Do not guess that mapping or claim an exact physical setting without a verified display value or documented conversion. Values outside the range are clamped.",
    input: { parameter: ParameterRefSchema, value: z.number() },
    describe: ({ parameter, value }, names) => t("toolActivity.setParameter", { parameter: names.parameter(parameter), parameter2: names.value(parameter, value) }),
  })
];

export const rackTools = [
  extensionTool({
    op: "rack_insert_chain",
    changes: "set",
    description: "Add an empty chain to a rack at a 0-based position (default: the end).",
    input: { device: DeviceRefSchema, index: z.number().int().min(0).optional() },
    describe: ({ device }, names) => t("toolActivity.addAChain", { device: names.device(device) }),
  }),
  extensionTool({
    op: "chain_insert_device",
    changes: "set",
    description: "Insert a built-in Live device, with its default sound, into a chain of a rack. device is the rack; chain is the 0-based chain index.",
    input: {
      device: DeviceRefSchema,
      chain: z.number().int().min(0),
      name: z.string().min(1).describe("Exact name of the built-in Live device"),
      index: z.number().int().min(0).optional(),
    },
    describe: ({ device, chain, name }, names) => t("toolActivity.addChainDevice", { device: names.chain(device, chain), name: name }),
  }),
  extensionTool({
    op: "chain_delete_device",
    changes: "set",
    description: "Remove a device that sits inside a rack chain (give its full chain path in the device reference).",
    input: { device: DeviceRefSchema },
    describe: ({ device }, names) => t("toolActivity.remove", { device: names.device(device) }),
  }),
  extensionTool({
    op: "chain_duplicate_device",
    changes: "set",
    description: "Duplicate a device inside a rack chain; the copy goes right after it.",
    input: { device: DeviceRefSchema },
    describe: ({ device }, names) => t("toolActivity.duplicate", { device: names.device(device) }),
  }),
  extensionTool({
    op: "drum_pad_set_note",
    changes: "set",
    description: "Set which MIDI note triggers a Drum Rack pad chain (device is the Drum Rack; chain is the pad's chain index).",
    input: { device: DeviceRefSchema, chain: z.number().int().min(0), note: z.number().int().min(0).max(127) },
    describe: ({ device, chain, note }, names) => t("toolActivity.playOn", { device: names.chain(device, chain), note: noteName(note) }),
  }),
  extensionTool({
    op: "simpler_replace_sample",
    changes: "set",
    description: "Load a different audio file into a Simpler (for example an available licensed drum one-shot or recorded sample).",
    input: { device: DeviceRefSchema, filePath: z.string().min(1) },
    describe: ({ device, filePath }, names) => t("toolActivity.load", { device: names.device(device), filePath: basename(filePath) }),
  })
];
