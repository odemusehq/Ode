import { z } from "zod";
import type { MidiMaterialOutput, MidiMaterialScope } from "../harness/midi-materials";
import { MidiMaterialRefSchema } from "../shared/midi-material";

type Path = readonly (string | number)[];
type Pattern = readonly (string | "*")[];
const TOP_NOTES: readonly Pattern[] = [["notes"]];

/** Only these known musical fields may contain exact-note references. */
const INPUTS: Readonly<Record<string, readonly Pattern[]>> = {
  midi_clip_set_notes: TOP_NOTES,
  track_create_midi_clip: TOP_NOTES,
  take_lane_create_midi_clip: TOP_NOTES,
  clip_slot_create_midi_clip: TOP_NOTES,
  melody_vary: TOP_NOTES,
  notes_edit: TOP_NOTES,
  notes_transform: TOP_NOTES,
  set_lyrics_to_melody: TOP_NOTES,
  lyrics_fit_melody: TOP_NOTES,
  prosody_check: TOP_NOTES,
  singability_check: TOP_NOTES,
  notes_check: [["notes"], ["lockTo"]],
  harmonize: [["melody"]],
  harmony_vocals_write: [["melody"]],
  bassline_write: [["kick"]],
  demo_vocal_render: [["lines", "*", "notes"]],
  melody_write: [["retainedHooks", "*", "notes"]],
};

/** Complete result collections, never arbitrary numeric arrays or checker findings. */
const OUTPUTS: Readonly<Record<string, readonly Pattern[]>> = {
  midi_clip_get_notes: TOP_NOTES,
  drum_groove_write: TOP_NOTES,
  bassline_write: TOP_NOTES,
  voice_chords: TOP_NOTES,
  melody_vary: TOP_NOTES,
  notes_edit: TOP_NOTES,
  notes_transform: TOP_NOTES,
  melody_write: [["notes"], ["phrases", "*", "notes"], ["retainedHooks", "*", "notes"]],
  harmony_vocals_write: [["parts", "*", "notes"]],
  set_lyrics_to_melody: [["notes"], ["melody", "notes"]],
  lyrics_fit_melody: [["lines", "*", "notes"], ["lines", "*", "phrase"], ["unassignedNotes"]],
  prosody_check: TOP_NOTES,
  singability_check: TOP_NOTES,
  hum_to_midi: TOP_NOTES,
};

function visit(value: unknown, pattern: Pattern, apply: (parent: Record<string | number, unknown>, key: string | number, path: (string | number)[]) => void, path: (string | number)[] = []): void {
  if (!value || typeof value !== "object" || pattern.length === 0) return;
  const [head, ...tail] = pattern;
  const keys = head === "*" && Array.isArray(value) ? value.map((_item, index) => index) : head === "*" ? [] : [head!];
  for (const key of keys) {
    const object = value as Record<string | number, unknown>;
    if (object[key] === undefined) continue;
    if (tail.length === 0) apply(object, key, [...path, key]);
    else visit(object[key], tail, apply, [...path, key]);
  }
}

/** Clone Zod containers so their original checks/defaults and the direct array API stay intact. */
function schemaAt(schema: z.ZodType, path: Pattern): z.ZodType {
  if (path.length === 0) return z.union([schema, MidiMaterialRefSchema]);
  if (schema instanceof z.ZodOptional) return schema.clone({ ...schema.def, innerType: schemaAt(schema.unwrap() as z.ZodType, path) });
  if (schema instanceof z.ZodDefault) return schema.clone({ ...schema.def, innerType: schemaAt(schema.unwrap() as z.ZodType, path) });
  const [head, ...tail] = path;
  if (schema instanceof z.ZodArray && head === "*") return schema.clone({ ...schema.def, element: schemaAt(schema.element as z.ZodType, tail) });
  if (schema instanceof z.ZodObject && head !== "*") {
    const child = schema.shape[head!] as z.ZodType | undefined;
    if (!child) throw new Error(`Unknown declared MIDI input ${String(head)}.`);
    // Ref-dependent refinements (for example hook.notes.every) require arrays. The original schema
    // runs after resolution, so defer these container checks rather than executing them on a ref.
    return schema.clone({ ...schema.def, shape: { ...schema.shape, [head!]: schemaAt(child, tail) }, checks: [] });
  }
  throw new Error("A declared MIDI input does not match its tool schema.");
}

export function midiInputSchema(name: string, shape: z.ZodRawShape): z.ZodObject {
  let schema: z.ZodType = z.object(shape);
  for (const path of INPUTS[name] ?? []) schema = schemaAt(schema, path);
  return schema as z.ZodObject;
}

export function midiDescription(name: string, description: string): string {
  if (!INPUTS[name] && !OUTPUTS[name]) return description;
  return `${description} During the current request, declared MIDI note fields also accept exact midi-material references in place of inline note arrays. Declared note outputs are retained as references before long results are shortened. Use midi_material_list/read to inspect exact notes and complete result metadata; these temporary references expire on Stop, request completion or restart. A reference does not prove the current Set or musical quality.`;
}

export interface ResolvedMidiInput { input: Record<string, unknown>; noteOrigins: string[] }

/** Resolve detached arrays only at declared inputs; canonical public arguments continue to contain their refs. */
export function resolveMidiInput(name: string, input: Record<string, unknown>, scope?: MidiMaterialScope): ResolvedMidiInput {
  const resolved = structuredClone(input);
  const origins = new Set<string>();
  for (const pattern of INPUTS[name] ?? []) visit(resolved, pattern, (parent, key, path) => {
    if (Array.isArray(parent[key])) return;
    const ref = MidiMaterialRefSchema.parse(parent[key]);
    if (!scope) throw new Error("Exact MIDI references need their active original song/request. Read or compute the notes again.");
    const material = scope.resolve(ref);
    parent[key] = material.notes;
    if (path.length === 1 && path[0] === "notes") for (const token of material.originReadTokens) origins.add(token);
  });
  return { input: resolved, noteOrigins: [...origins] };
}

/** Existing labels only inspect note counts, never placeholder pitches or musical data. */
export function midiLabelInput(name: string, input: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(input);
  for (const pattern of INPUTS[name] ?? []) visit(result, pattern, (parent, key) => {
    if (!Array.isArray(parent[key])) {
      const parsed = MidiMaterialRefSchema.safeParse(parent[key]);
      if (parsed.success) parent[key] = { length: parsed.data.count };
    }
  });
  return result;
}

export function midiOutputPaths(name: string, result: unknown, input: Record<string, unknown>, noteOrigins: readonly string[] = []): MidiMaterialOutput[] {
  const outputs: MidiMaterialOutput[] = [];
  const collect = (tool: string, value: unknown, prefix: Path = [], inherited: readonly string[] = []) => {
    for (const pattern of OUTPUTS[tool] ?? []) visit(value, pattern, (parent, key, path) => {
      if (!Array.isArray(parent[key])) return;
      const object = value as Record<string, unknown>;
      const tokens = tool === "midi_clip_get_notes" && typeof object.recoveryToken === "string"
        ? [object.recoveryToken]
        : (tool === "melody_vary" || tool === "set_lyrics_to_melody" || tool === "notes_edit" || tool === "notes_transform") && path.length === 1 && path[0] === "notes" ? inherited : [];
      outputs.push({ path: [...prefix, ...path], ...(tokens.length ? { originReadTokens: [...tokens] } : {}) });
    });
  };
  if (name === "apply_as_one_undo_step") {
    const calls = input.calls as { op: string }[];
    const results = (result as { results?: unknown[] }).results ?? [];
    calls.forEach((call, index) => collect(call.op, results[index], ["results", index]));
  } else collect(name, result, [], noteOrigins);
  return outputs;
}
