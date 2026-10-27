import { useState } from "react";
import type { ArtistFact } from "../../shared/api";
import { Badge, Button, ButtonGroup, ButtonVariant, IconButton, IconName, Notice, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { formatDateTime, formatPercent } from "../app/format";

const SOURCE_LABELS: Record<ArtistFact["source"], string> = { said: "You said", noticed: "Ode noticed" };
const SOURCE_TONES: Record<ArtistFact["source"], Tone> = { said: Tone.Info, noticed: Tone.Neutral };

export interface MemoryFactItemProps {
  fact: ArtistFact;
  onDelete: (id: string) => Promise<void>;
}

/** One thing Ode remembers, with where it came from; deleting asks for confirmation. */
export function MemoryFactItem({ fact, onDelete }: MemoryFactItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(fact.id);
    } catch (reason) {
      setError(errorMessage(reason));
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className="list-row">
      <div className="list-row__main">
        <p>{fact.value}</p>
        <div className="view-toolbar small">
          <Badge tone={SOURCE_TONES[fact.source]}>{SOURCE_LABELS[fact.source]}</Badge>
          <span className="muted">Confidence {formatPercent(fact.confidence)}</span>
          <span className="muted">Updated {formatDateTime(fact.updated)}</span>
        </div>
        {fact.evidence.length > 0 && (
          <details className="evidence">
            <summary>Evidence ({fact.evidence.length})</summary>
            <ul>
              {fact.evidence.map((evidence, index) => (
                <li key={index}>
                  {evidence.song && <strong>{evidence.song}: </strong>}
                  {evidence.note} ({formatDateTime(evidence.time)})
                </li>
              ))}
            </ul>
          </details>
        )}
        {error && <Notice tone={Tone.Danger}>This memory wasn't deleted: {error}</Notice>}
      </div>
      {confirming ? (
        <ButtonGroup label="Delete this memory?">
          <Button variant={ButtonVariant.Danger} onClick={() => void remove()} disabled={deleting}>
            Delete
          </Button>
          <Button onClick={() => setConfirming(false)} disabled={deleting}>
            Cancel
          </Button>
        </ButtonGroup>
      ) : (
        <IconButton icon={IconName.Trash} label="Delete this memory" onClick={() => setConfirming(true)} />
      )}
    </li>
  );
}
