import type { ClipRef, Note } from "./live";
import type { LeadSheet } from "./song";

/** Exact writes recorded at the writer, rather than inferred from a request-period snapshot. */
export type MutationReceipt =
  | { kind: "midi-notes"; clip: ClipRef; token: string; before: Note[]; after: Note[] }
  | { kind: "lyrics"; songId: string; before: string; after: string; beforeRevision: number; afterRevision: number }
  | { kind: "sheet-fields"; songId: string; before: Partial<LeadSheet>; after: Partial<LeadSheet>; beforeAbsent?: (keyof LeadSheet)[]; afterAbsent?: (keyof LeadSheet)[] }
  | { kind: "unverified"; tool: string; reason: string };

export type VerifiedMutationReceipt = Exclude<MutationReceipt, { kind: "unverified" }>;

export interface RecoveryReceipt {
  receipts: MutationReceipt[];
  /** At least one operation lacks a writer receipt; whole-state rollback must not infer ownership. */
  unverified: boolean;
  /** A recovery attempt reserves its inverse once, before dispatch, including across restarts. */
  used?: boolean;
}

/** Internal writer results carry these separately from the material shown to the model. */
export const MUTATION_RECEIPTS = "__odeReceipts";

export function isMutationReceipt(value: unknown): value is MutationReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  const object = (item: unknown) => Boolean(item && typeof item === "object" && !Array.isArray(item));
  const notes = (item: unknown) => Array.isArray(item) && item.every((note) => object(note) &&
    [note.pitch, note.start, note.duration].every((part) => typeof part === "number" && Number.isFinite(part)));
  switch (receipt.kind) {
    case "midi-notes": return object(receipt.clip) && typeof receipt.token === "string" && notes(receipt.before) && notes(receipt.after);
    case "lyrics": return typeof receipt.songId === "string" && typeof receipt.before === "string" && typeof receipt.after === "string" &&
      Number.isInteger(receipt.beforeRevision) && Number.isInteger(receipt.afterRevision);
    case "sheet-fields": return typeof receipt.songId === "string" && object(receipt.before) && object(receipt.after) &&
      [receipt.beforeAbsent, receipt.afterAbsent].every((fields) => fields === undefined || Array.isArray(fields) && fields.every((field) => typeof field === "string"));
    case "unverified": return typeof receipt.tool === "string" && typeof receipt.reason === "string";
    default: return false;
  }
}
