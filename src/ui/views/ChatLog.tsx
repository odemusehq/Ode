import { useLayoutEffect, useRef } from "react";
import { EmptyState } from "../../ui-kit";
import { UI_CONFIG } from "../app/config";
import { useAppState } from "../app/hooks";
import { ChatEntryItem } from "./ChatEntryItem";

/** The conversation; keeps the newest text in view unless the musician has scrolled up. */
export function ChatLog() {
  const chat = useAppState((state) => state.chat);
  const approvals = useAppState((state) => state.approvals);
  const log = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useLayoutEffect(() => {
    const element = log.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [chat]);

  const handleScroll = () => {
    const element = log.current;
    if (!element) return;
    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < UI_CONFIG.chatFollowThresholdPx;
  };

  return (
    <div ref={log} className="chat__log" role="log" aria-label="Conversation with Ode" onScroll={handleScroll}>
      {chat.length === 0 ? (
        <EmptyState title="Ask Ode about your song">
          Start anywhere: a title, a lyric, chords, a groove or a sound. You can also right-click a clip or track in Live and
          choose Ask Ode.
        </EmptyState>
      ) : (
        chat.map((entry) => <ChatEntryItem key={entry.id} entry={entry} approvals={approvals} />)
      )}
    </div>
  );
}
