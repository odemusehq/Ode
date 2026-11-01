/** A short public action receipt; never private model reasoning. */
export interface ConversationActivity {
  id: string;
  label: string;
  status: "running" | "done" | "error";
  reason?: string;
}

/** A saved exchange remains visible independently of the model context window. */
export interface ConversationExchange {
  id: string;
  request: string;
  attachments?: import("./composer").ComposerAttachment[];
  reply: string;
  at: string;
  activity?: ConversationActivity[];
  rationale?: string;
  versionId?: string | null;
  status: "running" | "complete" | "stopped" | "failed";
}
