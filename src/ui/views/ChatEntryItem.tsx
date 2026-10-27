import { ActivityLine, ActivityStatus, ChatMessage, Notice, Tone } from "../../ui-kit";
import { toolWords } from "../app/format";
import { ChatEntryKind } from "../app/model";
import type { Approval, ChatEntry, SubagentEntry, ToolEntry } from "../app/model";
import { ApprovalItem } from "./ApprovalItem";

const TOOL_STATUS: Record<ToolEntry["status"], ActivityStatus> = {
  started: ActivityStatus.Running,
  done: ActivityStatus.Done,
  error: ActivityStatus.Failed,
};

const SUBAGENT_STATUS: Record<SubagentEntry["status"], ActivityStatus> = {
  started: ActivityStatus.Running,
  done: ActivityStatus.Done,
};

export interface ChatEntryItemProps {
  entry: ChatEntry;
  approvals: readonly Approval[];
}

export function ChatEntryItem({ entry, approvals }: ChatEntryItemProps) {
  switch (entry.kind) {
    case ChatEntryKind.Message:
      return <ChatMessage role={entry.role} text={entry.text} streaming={entry.streaming} pending={entry.pending} />;
    case ChatEntryKind.Tool:
      return <ActivityLine status={TOOL_STATUS[entry.status]} text={entry.summary ?? toolWords(entry.name)} />;
    case ChatEntryKind.Subagent:
      return <ActivityLine status={SUBAGENT_STATUS[entry.status]} text={`Subagent: ${entry.task}`} />;
    case ChatEntryKind.Approval: {
      const approval = approvals.find((candidate) => candidate.id === entry.approvalId);
      return approval ? <ApprovalItem approval={approval} /> : null;
    }
    case ChatEntryKind.Error:
      return <Notice tone={Tone.Danger}>{entry.message}</Notice>;
  }
}
