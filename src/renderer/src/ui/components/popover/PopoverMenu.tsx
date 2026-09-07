import React, { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { type IMenuAction, PopoverMenuItem } from "@/ui/components/popover/PopoverMenuItem";

interface IPopoverMenuProps {
  actions: IMenuAction[][];
  label: string;
  onSelect: () => void;
  onClose?: () => void;
}

/**
 * A menu of actions filling a {@link PopoverPanel}.
 *
 * A `Popover` rather than a `Menu`, because an action here can open a panel of its
 * own and a `Menu` closes the moment focus reaches one — it has no notion of a
 * surface nested inside it, where a `Popover` registers a child's portal as part of
 * itself. What `Menu` would have given us for free is supplied here instead: the
 * menu roles, focus on open, and arrow-key navigation.
 */
export const PopoverMenu = ({ actions, label, onClose, onSelect }: IPopoverMenuProps) => {
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Which row the menu considers focused. The highlight reads from this rather than
   * from `:hover` or `:focus-visible`, so the pointer and the arrow keys can't light
   * up two rows between them.
   *
   * Focus feeds it: arrowing moves focus, hovering a row takes focus, and opening the
   * menu focuses the first row. Nothing clears it, so a row keeps the highlight while
   * the submenu it opened holds focus.
   */
  const [focusedRow, setFocusedRow] = useState(0);

  const focusableRows = () =>
    rowsRef.current.filter((row): row is HTMLButtonElement => !!row && !row.disabled);

  useEffect(() => {
    focusableRows()[0]?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A panel opened from a row is portalled out of this element but remains a
    // React child of it, so its key presses arrive here too. Only the rows' own
    // keys may move the roving focus.
    if (!event.currentTarget.contains(event.target as Node)) {
      return;
    }

    if (event.key === "ArrowLeft" && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    const focusable = focusableRows();
    const focused = event.currentTarget.ownerDocument.activeElement;
    // The row focus is on, or the row holding whatever is — a row can contain a
    // control of its own, such as a pin, and arrowing from there has to carry on
    // from that row rather than from nowhere.
    const current = focusable.findIndex((row) => row === focused || row.contains(focused));

    const destinations: Record<string, number | undefined> = {
      ArrowDown: current + 1,
      ArrowUp: current <= 0 ? focusable.length - 1 : current - 1,
      End: focusable.length - 1,
      Home: 0,
    };

    const destination = destinations[event.key];

    if (destination === undefined || !focusable.length) {
      return;
    }

    event.preventDefault();
    focusable[destination % focusable.length]?.focus();
  };

  // Groups are a visual device only — the rows are laid out and focused as one flat
  // list, so arrowing runs through the whole menu rather than stopping at a rule,
  // and one group's refs can't overwrite another's.
  let nextIndex = 0;
  const sections = actions
    .filter((section) => section.length > 0)
    .map((section) => section.map((action) => ({ action, index: nextIndex++ })));

  return (
    <div
      aria-label={label}
      className="flex flex-col gap-y-0.5"
      role="menu"
      onKeyDown={handleKeyDown}
    >
      {sections.map((section, sectionIndex) => (
        <Fragment key={sectionIndex}>
          {sectionIndex > 0 && <DropdownDivider />}

          {section.map(({ action, index }) => (
            <PopoverMenuItem
              action={action}
              hasFocus={index === focusedRow}
              key={index}
              ref={(element) => {
                rowsRef.current[index] = element;
              }}
              tabIndex={index === 0 ? 0 : -1}
              onTakeFocus={() => setFocusedRow(index)}
              onSelect={onSelect}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
};
