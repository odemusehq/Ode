import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";
import "./Tabs.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Short text next to the label, e.g. a count. */
  badge?: string;
  /** What the badge means, for assistive technology. */
  badgeLabel?: string;
}

export interface TabsProps<T extends string> {
  /** Names the tab list for assistive technology. */
  label: string;
  items: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Content of the selected tab. */
  children: ReactNode;
}

const NEXT_KEYS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function Tabs<T extends string>({ label, items, selected, onSelect, children }: TabsProps<T>) {
  const prefix = useId();
  const tabs = useRef(new Map<T, HTMLButtonElement>());

  useEffect(() => {
    tabs.current.get(selected)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  const select = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    onSelect(item.id);
    tabs.current.get(item.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((item) => item.id === selected);
    const step = NEXT_KEYS[event.key];
    if (step !== undefined) select(current + step);
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(items.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="ode-tabs">
      <div role="tablist" aria-label={label} className="ode-tabs__list" onKeyDown={handleKeyDown}>
        {items.map((item) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(element) => {
                if (element) tabs.current.set(item.id, element);
                else tabs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${prefix}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${prefix}-panel`}
              tabIndex={isSelected ? 0 : -1}
              className={cx("ode-tabs__tab", isSelected && "ode-tabs__tab--selected")}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
              {item.badge && (
                <span className="ode-tabs__badge" aria-hidden="true">
                  {item.badge}
                </span>
              )}
              {item.badgeLabel && <span className="ode-visually-hidden">, {item.badgeLabel}</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${selected}`} className="ode-tabs__panel">
        {children}
      </div>
    </div>
  );
}
