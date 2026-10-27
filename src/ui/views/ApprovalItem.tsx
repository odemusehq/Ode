import { ApprovalCard } from "../../ui-kit";
import { useClient } from "../app/hooks";
import type { Approval } from "../app/model";

export interface ApprovalItemProps {
  approval: Approval;
}

/** An approval request wired to the server. */
export function ApprovalItem({ approval }: ApprovalItemProps) {
  const client = useClient();
  return (
    <ApprovalCard
      tool={approval.tool}
      summary={approval.summary}
      input={approval.input}
      status={approval.status}
      onAllow={() => void client.decide(approval.id, "allow")}
      onDeny={() => void client.decide(approval.id, "deny")}
      onAlwaysAllow={() => void client.decide(approval.id, "allow", true)}
    />
  );
}
