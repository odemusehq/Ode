import { useMemo } from "react";
import { Menu, MenuAlign } from "../../ui-kit";
import type { MenuItem } from "../../ui-kit";
import type { Mode } from "../../shared/personalisation";
import { useAppState, useClient } from "../app/hooks";
import { MODE_DESCRIPTIONS, MODE_LABELS, MODE_ORDER } from "../app/modes";

const MENU_LABEL = "Mode";

/** The header's mode menu: Auto, Manual or Let me hear it, each with a line saying what it does. */
export function ModePicker() {
  const client = useClient();
  const mode = useAppState((state) => state.mode);
  const items = useMemo(
    (): MenuItem<Mode>[] =>
      MODE_ORDER.map((id) => ({ id, label: MODE_LABELS[id], description: MODE_DESCRIPTIONS[id], checked: id === mode })),
    [mode],
  );

  return (
    <Menu
      label={MENU_LABEL}
      buttonText={mode ? MODE_LABELS[mode] : MENU_LABEL}
      items={items}
      align={MenuAlign.End}
      onSelect={(next) => {
        if (next !== mode) void client.setMode(next);
      }}
    />
  );
}
