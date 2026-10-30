import { t } from "../../shared/i18n";
import { Mode } from "../../shared/personalisation";

export const MODE_ORDER: readonly Mode[] = [Mode.Auto, Mode.Manual];

export const MODE_LABELS: Record<Mode, string> = {
  [Mode.Auto]: t("modes.auto.label"),
  [Mode.Manual]: t("modes.manual.label"),
};

/** One line each, under the mode's name in the menu. */
export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  [Mode.Auto]: t("modes.auto.description"),
  [Mode.Manual]: t("modes.manual.description"),
};
