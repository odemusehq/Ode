import { t } from "../../shared/i18n";
import { Button, ButtonVariant, Card, IconName, Tone } from "../../ui-kit";
import { useClient } from "../app/hooks";
import type { Approval } from "../app/model";

export interface ApplyCardProps {
  approval: Approval;
}

/** A change Ode wants to make, in one line, with Apply and Skip. */
export function ApplyCard({ approval }: ApplyCardProps) {
  const client = useClient();
  return (
    <Card
      tone={Tone.Accent}
      waiting={approval.decided}
      actions={
        <>
          <Button variant={ButtonVariant.Primary} icon={IconName.Check} disabled={approval.decided} onClick={() => void client.decide(approval.id, "allow")}>
            {t("common.apply")}
          </Button>
          <Button disabled={approval.decided} onClick={() => void client.decide(approval.id, "deny")}>
            {t("common.skip")}
          </Button>
        </>
      }
    >
      {approval.summary}
    </Card>
  );
}
