import type { KeyboardEvent } from "react";

import { hasModifierKey } from "@/ui/utils/hasModifierKey";

interface IRovingFocusOptions {
  /** Which arrows move along the items: Up and Down, or Left and Right. */
  orientation: "horizontal" | "vertical";
  /** Matches the items, inside the element whose `onKeyDown` this handles. */
  itemSelector: string;
  /** Whether moving past either end comes round to the other. Default `false`. */
  wrap?: boolean;
  /** Told the index of the item moved to, before it takes focus. */
  onMove?: (index: number) => void;
}

const KEYS = {
  horizontal: { back: "ArrowLeft", forward: "ArrowRight" },
  vertical: { back: "ArrowUp", forward: "ArrowDown" },
};

/**
 * Moves focus between a set of items from the keyboard, for a list or bar that's one Tab stop:
 * the arrows for its `orientation` step to the item before or after the focused one, and Home and
 * End go to either end. Keys with a modifier, keys from outside an item, and every other key are
 * left alone. Returns whether it handled the key, so a caller can go on to its own.
 */
export const rovingFocus = (
  event: KeyboardEvent<HTMLElement>,
  { orientation, itemSelector, wrap = false, onMove }: IRovingFocusOptions,
): boolean => {
  const current =
    event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(itemSelector) : null;

  if (!current || !event.currentTarget.contains(current) || hasModifierKey(event)) {
    return false;
  }

  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(itemSelector)];
  const at = items.indexOf(current);
  const { back, forward } = KEYS[orientation];
  const steps: Partial<Record<string, number>> = {
    [back]: at - 1,
    [forward]: at + 1,
    Home: 0,
    End: items.length - 1,
  };
  let next = steps[event.key];

  if (next === undefined) {
    return false;
  }

  event.preventDefault();

  if (wrap) {
    next = (next + items.length) % items.length;
  }

  if (next < 0 || next >= items.length || next === at) {
    return true;
  }

  onMove?.(next);
  items[next].focus();
  return true;
};
