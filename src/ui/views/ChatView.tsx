import { ChatComposer } from "./ChatComposer";
import { ChatLog } from "./ChatLog";
import "./ChatView.css";

export function ChatView() {
  return (
    <div className="chat">
      <ChatLog />
      <ChatComposer />
    </div>
  );
}
