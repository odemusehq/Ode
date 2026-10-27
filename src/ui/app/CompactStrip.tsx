import { useMemo } from "react";
import { BusyIndicator, toPlainText } from "../../ui-kit";
import { ConnectionList } from "./ConnectionList";
import { SERVER_MESSAGES } from "./connections";
import { useAppState } from "./hooks";
import { ChatEntryKind } from "./model";
import type { ChatEntry } from "./model";
import { Logo } from "./Logo";

/** The short layout for the device area in Live: status, the latest reply and where to find the rest. */
export function CompactStrip() {
  const busy = useAppState((state) => state.busy);
  const live = useAppState((state) => state.live);
  const stream = useAppState((state) => state.stream);
  const chat = useAppState((state) => state.chat);
  const latest = useMemo(() => latestReply(chat), [chat]);

  return (
    <div className="strip">
      <Logo />
      <div className="strip__status">
        <BusyIndicator busy={busy} />
        <ConnectionList status={live} />
      </div>
      <p className="strip__message">{SERVER_MESSAGES[stream] ?? (latest || "No replies yet.")}</p>
      <p className="strip__hint">Open the Ode window to chat and see everything.</p>
    </div>
  );
}

function latestReply(chat: readonly ChatEntry[]): string {
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    const entry = chat[index];
    if (entry?.kind === ChatEntryKind.Message && entry.role === "assistant") return toPlainText(entry.text);
  }
  return "";
}
