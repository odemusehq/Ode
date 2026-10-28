import { Chip, ChipGroup, IconName, Tone } from "../../ui-kit";
import { useAppState, useClient } from "../app/hooks";

/** One-tap actions for what is selected; fixes for problems the checks found come first, marked. */
export function SuggestionChips() {
  const client = useClient();
  const suggestions = useAppState((state) => state.suggestions);
  const busy = useAppState((state) => state.busy);

  if (suggestions.length === 0) return null;

  return (
    <ChipGroup label="Suggestions">
      {suggestions.map((suggestion) => (
        <Chip
          key={suggestion.id}
          tone={suggestion.fix ? Tone.Warning : Tone.Neutral}
          icon={suggestion.fix ? IconName.Alert : undefined}
          disabled={busy}
          onClick={() => void client.tap(suggestion)}
        >
          {suggestion.fix && <span className="ode-visually-hidden">Fix: </span>}
          {suggestion.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
