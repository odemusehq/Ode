import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { MemoryAdd } from "../../shared/api";
import { Button, ButtonVariant, Field, Notice, Panel, TextArea, TextInput, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { MEMORY_TOPICS } from "../app/config";

export interface MemoryAddFormProps {
  /** Topics already in memory, offered as suggestions. */
  topics: readonly string[];
  onAdd: (item: MemoryAdd) => Promise<void>;
}

export function MemoryAddForm({ topics, onAdd }: MemoryAddFormProps) {
  const [topic, setTopic] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topicId = useId();
  const valueId = useId();
  const suggestionsId = useId();
  const suggestions = useMemo(() => [...new Set([...topics, ...MEMORY_TOPICS])], [topics]);
  const ready = topic.trim() !== "" && value.trim() !== "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await onAdd({ topic: topic.trim(), value: value.trim() });
      setValue("");
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Tell Ode something about you">
      <form className="plain-list" onSubmit={(event) => void submit(event)}>
        <Field id={topicId} label="Topic">
          <TextInput
            id={topicId}
            list={suggestionsId}
            value={topic}
            placeholder="e.g. rhyme taste"
            onChange={(event) => setTopic(event.target.value)}
          />
        </Field>
        <datalist id={suggestionsId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <Field id={valueId} label="What Ode should know">
          <TextArea
            id={valueId}
            rows={2}
            value={value}
            placeholder="e.g. I like near rhymes more than perfect rhymes"
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        {error && <Notice tone={Tone.Danger}>This wasn't added: {error}</Notice>}
        <div>
          <Button type="submit" variant={ButtonVariant.Primary} disabled={saving || !ready}>
            Add
          </Button>
        </div>
      </form>
    </Panel>
  );
}
