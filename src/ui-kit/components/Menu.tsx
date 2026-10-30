import { t } from "../../shared/i18n";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon, IconName } from "./Icon";
import { cx } from "./cx";
import "./Button.css";
import "./Menu.css";

export interface MenuItem<T extends string> {
  id: T;
  label: string;
  /** One line under the label saying what the item does. */
  description?: string;
  /** For a choice between options: whether this one is chosen. Leave out for plain actions. */
  checked?: boolean;
  icon?: IconName;
}

export enum MenuAlign {
  Start = "start",
  End = "end",
}

export interface MenuProps<T extends string> {
  /** Names the menu; also the button's name when it shows only an icon. */
  label: string;
  /** Text on the button; without it the button shows only the icon. */
  buttonText?: string;
  icon?: IconName;
  items: readonly MenuItem<T>[];
  onSelect: (id: T) => void;
  /** Which edge of the button the menu lines up with. */
  align?: MenuAlign;
  disabled?: boolean;
  /** Independent options use checkbox semantics; a single selection uses radio semantics. */
  multiple?: boolean;
}

const NEXT_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** A button that opens a short list of actions, or of options with the chosen one checked. */
export function Menu<T extends string>({ label, buttonText, icon, items, onSelect, align = MenuAlign.Start, disabled, multiple = false }: MenuProps<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemButtons = useRef(new Map<T, HTMLButtonElement>());
  const menuId = useId();
  const choice = items.some((item) => item.checked !== undefined);

  // Runs when the menu opens or closes only: focus goes to the chosen item (or the first) once, on opening.
  useEffect(() => {
    if (!open) return;
    const start = items.find((item) => item.checked) ?? items[0];
    if (start) itemButtons.current.get(start.id)?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  const choose = (id: T) => {
    close(true);
    onSelect(id);
  };

  const focusAt = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (item) itemButtons.current.get(item.id)?.focus();
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (NEXT_KEYS[event.key] === undefined) return;
    event.preventDefault();
    setOpen(true);
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = items.findIndex((item) => itemButtons.current.get(item.id) === document.activeElement);
    const step = NEXT_KEYS[event.key];
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (step !== undefined) focusAt(current + step);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(items.length - 1);
    else if (event.key === "Escape") close(true);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={root} className="ode-menu">
      <button
        ref={button}
        type="button"
        className={cx("ode-button", "ode-button--quiet", buttonText ? "ode-menu__button" : "ode-icon-button", open && "ode-menu__button--open")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonText ? t("kit.menuLabel", { label: (label), value: (buttonText) }) : label}
        title={buttonText ? undefined : label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
      >
        {icon && <Icon name={icon} />}
        {buttonText && <span className="ode-menu__button-text">{buttonText}</span>}
        {buttonText && <Icon name={IconName.ChevronDown} />}
      </button>
      {open && (
        <ul id={menuId} role="menu" aria-label={label} className={cx("ode-menu__list", `ode-menu__list--${align}`)} onKeyDown={handleListKeyDown}>
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                ref={(element) => {
                  if (element) itemButtons.current.set(item.id, element);
                  else itemButtons.current.delete(item.id);
                }}
                type="button"
                role={choice ? (multiple ? "menuitemcheckbox" : "menuitemradio") : "menuitem"}
                aria-checked={choice ? Boolean(item.checked) : undefined}
                tabIndex={-1}
                className={cx("ode-menu__item", item.checked && "ode-menu__item--checked")}
                onClick={() => choose(item.id)}
              >
                <span className="ode-menu__mark">
                  {choice ? item.checked && <Icon name={IconName.Check} /> : item.icon && <Icon name={item.icon} />}
                </span>
                <span className="ode-menu__text">
                  <span className="ode-menu__label">{item.label}</span>
                  {item.description && <span className="ode-menu__description">{item.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
