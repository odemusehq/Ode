import { z } from "zod";

export const ComposerAttachmentSchema = z.object({
  /** One selection in the composer; reattaching the same audio uses a new entryId. */
  entryId: z.uuid(),
  id: z.uuid(),
  scope: z.enum(["sample", "reference", "processed-bounce"]),
  name: z.string().min(1).max(255),
});
export type ComposerAttachment = z.infer<typeof ComposerAttachmentSchema>;

export const ComposerDraftSchema = z.object({
  text: z.string().max(32768).refine((text) => new TextEncoder().encode(text).length <= 32768, "Keep the draft within 32 KiB."),
  /** Changes on every text edit, including deleting and retyping identical words; attachments preserve it. */
  textEditId: z.uuid(),
  attachments: z.array(ComposerAttachmentSchema).max(16),
}).refine((draft) => new Set(draft.attachments.map((entry) => entry.entryId)).size === draft.attachments.length, "Each attachment selection needs its own entryId.")
  .refine((draft) => new TextEncoder().encode(JSON.stringify(draft)).length <= 48 * 1024, "Keep the complete saved draft within 48 KiB.");
export type ComposerDraft = z.infer<typeof ComposerDraftSchema>;

export const ComposerPendingSchema = z.object({ requestId: z.uuid(), payload: z.string(), snapshot: ComposerDraftSchema });
export type ComposerPending = z.infer<typeof ComposerPendingSchema>;

export const ComposerConflictSchema = z.object({
  id: z.uuid(), writerId: z.uuid(), draft: ComposerDraftSchema, baseRevision: z.number().int().min(0), createdAt: z.iso.datetime(),
});
export type ComposerConflict = z.infer<typeof ComposerConflictSchema>;

export interface ComposerState {
  songId: string;
  revision: number;
  draft: ComposerDraft;
  pending: ComposerPending | null;
  /** Latest rejected save per writer, retained across closure and exposed for explicit inline recovery. */
  conflicts: ComposerConflict[];
  /** prepare found this exact snapshot already accepted; never dispatch it under a fresh id. */
  acceptedRequestId?: string;
}

const Identity = { songId: z.uuid(), writerId: z.uuid(), writeId: z.uuid(), baseRevision: z.number().int().min(0) };
export const ComposerWriteSchema = z.object({ ...Identity, sequence: z.number().int().min(0), draft: ComposerDraftSchema });
export type ComposerWrite = z.infer<typeof ComposerWriteSchema>;
export const ComposerPrepareSchema = z.object({ ...Identity, snapshot: ComposerDraftSchema });
export type ComposerPrepare = z.infer<typeof ComposerPrepareSchema>;
export const ComposerResolveSchema = z.object({ ...Identity, conflictId: z.uuid(), choice: z.enum(["local", "saved"]) });
export type ComposerResolve = z.infer<typeof ComposerResolveSchema>;
export const ComposerCancelSchema = z.object({ songId: z.uuid(), requestId: z.uuid() });
export type ComposerCancel = z.infer<typeof ComposerCancelSchema>;
