import { z } from "zod";

const ShortText = z.string().trim().min(1).max(1_000);
const Targets = z.array(z.string().trim().min(1).max(200)).max(16).default([]);
const EvidenceDetails = { summary: ShortText, targets: Targets };

/** A citation to saved public observations, never a tool's success flag or private reasoning. */
export const ProductionEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tool"), exchangeId: ShortText, toolCallId: ShortText, ...EvidenceDetails }),
  z.object({ kind: z.literal("version"), versionId: ShortText, ...EvidenceDetails }),
  z.object({ kind: z.literal("musician"), exchangeId: ShortText, quote: ShortText, ...EvidenceDetails }),
]);
export type ProductionEvidence = z.infer<typeof ProductionEvidenceSchema>;

export const ProductionStepStatusSchema = z.enum(["pending", "working", "needs-inspection", "blocked", "complete"]);
export const ProductionStepInputSchema = z.object({
  id: z.uuid().optional(),
  action: ShortText,
  status: ProductionStepStatusSchema.default("pending"),
  targetTags: Targets,
  evidence: z.array(ProductionEvidenceSchema).max(8).default([]),
  blocker: ShortText.optional(),
});
export const ProductionStepSchema = ProductionStepInputSchema.extend({ id: z.uuid() });
export type ProductionStep = z.infer<typeof ProductionStepSchema>;

/** One bounded current plan. Actual notes, lyrics and musical decisions stay in Live and the lead sheet. */
export const ProductionTaskSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  songId: ShortText,
  revision: z.number().int().positive(),
  goal: ShortText,
  brief: z.string().trim().min(1).max(6_000),
  steps: z.array(ProductionStepSchema).min(1).max(24),
  status: z.enum(["planned", "working", "needs-inspection", "blocked", "complete"]),
  blocker: ShortText.optional(),
  inspectionReason: ShortText.optional(),
  exchangeIds: z.array(ShortText).max(100),
  versionIds: z.array(ShortText).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProductionTask = z.infer<typeof ProductionTaskSchema>;

/** Updating a plan does not execute any of its steps. Replacement archives the previous task first. */
export const ProductionTaskUpdateSchema = z.object({
  taskId: z.uuid().optional(),
  baseRevision: z.number().int().min(0),
  goal: ShortText,
  brief: z.string().trim().min(1).max(6_000),
  steps: z.array(ProductionStepInputSchema).min(1).max(24),
  replace: z.boolean().optional(),
  blocker: ShortText.nullish(),
  exchangeId: ShortText.optional(),
  versionId: ShortText.optional(),
});
export type ProductionTaskUpdate = z.input<typeof ProductionTaskUpdateSchema>;
