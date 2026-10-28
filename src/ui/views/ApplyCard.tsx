import { Button, ButtonVariant, Card, IconName, Tone } from "../../ui-kit";
import { useClient } from "../app/hooks";
import type { Approval } from "../app/model";

export interface ApplyCardProps {
  approval: Approval;
}

/** Manual mode: the change Ode wants to make, in one line, with Apply and Skip. */
export function ApplyCard({ approval }: ApplyCardProps) {
  const client = useClient();
  return (
    <Card
      kicker="Change waiting"
      tone={Tone.Accent}
      waiting={approval.decided}
      actions={
        <>
          <Button
            variant={ButtonVariant.Primary}
            icon={IconName.Check}
            disabled={approval.decided}
            onClick={() => void client.decide(approval.id, "allow")}
          >
            Apply
          </Button>
          <Button disabled={approval.decided} onClick={() => void client.decide(approval.id, "deny")}>
            Skip
          </Button>
        </>
      }
    >
      {approval.summary}
    </Card>
  );
}
