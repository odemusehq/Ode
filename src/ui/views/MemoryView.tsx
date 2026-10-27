import { useCallback, useMemo } from "react";
import type { ArtistFact, MemoryAdd } from "../../shared/api";
import { EmptyState, Notice, Panel, Tone } from "../../ui-kit";
import { useClient, useRequest } from "../app/hooks";
import { MemoryAddForm } from "./MemoryAddForm";
import { MemoryFactItem } from "./MemoryFactItem";
import "./views.css";

interface TopicGroup {
  topic: string;
  facts: ArtistFact[];
}

export function MemoryView() {
  const client = useClient();
  const loadMemory = useCallback(() => client.api.getMemory(), [client]);
  const memory = useRequest(loadMemory);
  const groups = useMemo(() => groupByTopic(memory.data ?? []), [memory.data]);
  const topics = useMemo(() => groups.map((group) => group.topic), [groups]);
  const { setData } = memory;

  const remove = useCallback(
    async (id: string) => {
      await client.api.deleteMemory(id);
      setData((facts) => facts?.filter((fact) => fact.id !== id));
    },
    [client, setData],
  );

  const add = useCallback(
    async (item: MemoryAdd) => {
      const fact = await client.api.addMemory(item);
      setData((facts) => [...(facts ?? []), fact]);
    },
    [client, setData],
  );

  return (
    <div className="view">
      <p className="muted">
        What Ode knows about you as an artist, and why. Ode learns only from your own songs and words, and what you say always
        wins.
      </p>
      {memory.error && <Notice tone={Tone.Danger}>Memory couldn't be read: {memory.error}</Notice>}
      {memory.loading && !memory.data && <p className="muted">Reading memory…</p>}
      {memory.data && groups.length === 0 && (
        <EmptyState title="Nothing remembered yet">Ode adds what it notices as you work, and anything you tell it below.</EmptyState>
      )}
      {groups.map((group) => (
        <Panel key={group.topic} title={group.topic}>
          <ul className="plain-list">
            {group.facts.map((fact) => (
              <MemoryFactItem key={fact.id} fact={fact} onDelete={remove} />
            ))}
          </ul>
        </Panel>
      ))}
      <MemoryAddForm topics={topics} onAdd={add} />
    </div>
  );
}

function groupByTopic(facts: readonly ArtistFact[]): TopicGroup[] {
  const groups = new Map<string, ArtistFact[]>();
  for (const fact of facts) {
    const group = groups.get(fact.topic);
    if (group) group.push(fact);
    else groups.set(fact.topic, [fact]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, items]) => ({ topic, facts: items.sort((a, b) => b.updated.localeCompare(a.updated)) }));
}
