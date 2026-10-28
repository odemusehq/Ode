import { Mode } from "../../shared/personalisation";

export const MODE_ORDER: readonly Mode[] = [Mode.Auto, Mode.Manual, Mode.LetMeHearIt];

export const MODE_LABELS: Record<Mode, string> = {
  [Mode.Auto]: "Auto",
  [Mode.Manual]: "Manual",
  [Mode.LetMeHearIt]: "Let me hear it",
};

/** One line each, under the mode's name in the menu. */
export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  [Mode.Auto]: "Changes what it's sure of, asks when it can't tell",
  [Mode.Manual]: "Asks before every change",
  [Mode.LetMeHearIt]: "Applies everything straight away and plays it",
};
