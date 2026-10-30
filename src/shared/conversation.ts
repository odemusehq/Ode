import type { AudioDeliveryRef } from "./audio-delivery";

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
  reply: string;
  at: string;
  activity?: ConversationActivity[];
  rationale?: string;
  versionId?: string | null;
  /** Trusted references to retained supplied audio; URLs are rebuilt for the current local server. */
  deliveries?: AudioDeliveryRef[];
  status: "running" | "complete" | "stopped" | "failed";
}
