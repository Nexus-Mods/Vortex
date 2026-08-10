import { mdiDotsHorizontal } from "@mdi/js";
import React, { type KeyboardEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import type { IToolbarAction } from "./ToolbarGroup";
import { ToolbarOverflowItem } from "./ToolbarOverflowItem";
import { TOOLBAR_OVERFLOW_ATTRIBUTE } from "./useToolbarOverflow.hook";

interface IToolbarOverflowProps {
  actions: IToolbarAction[];
}

const ToolbarOverflowMenu = ({
  actions,
  label,
  onSelect,
}: {
  actions: IToolbarAction[];
  label: string;
  onSelect: () => void;
}) => {
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const focusableRows = () =>
    rowsRef.current.filter((row): row is HTMLButtonElement => !!row && !row.disabled);

  // Opening the menu moves focus into it, as a menu should. Only a keyboard
  // opener sees a focus ring for it: `:focus-visible` ignores programmatic focus
  // that followed a click.
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

    const focusable = focusableRows();
    const active = event.currentTarget.ownerDocument.activeElement;
    const current = focusable.indexOf(active as HTMLButtonElement);

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

  return (
    <div aria-label={label} className="flex flex-col" role="menu" onKeyDown={handleKeyDown}>
      {actions.map((action, index) => (
        <ToolbarOverflowItem
          action={action}
          key={action.label}
          ref={(row) => {
            rowsRef.current[index] = row;
          }}
          tabIndex={index === 0 ? 0 : -1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

/**
 * The actions a group had no room for, as a menu hung off a kebab button.
 *
 * A `Popover` rather than a `Menu`, because an action here can open a panel of
 * its own and a `Menu` closes the moment focus reaches one — it has no notion of
 * a surface nested inside it, where a `Popover` registers a child's portal as
 * part of itself. What `Menu` would have given us for free is supplied here
 * instead: the menu roles, focus on open, and arrow-key navigation.
 */
export const ToolbarOverflow = ({ actions }: IToolbarOverflowProps) => {
  const { t } = useTranslation();
  const label = t("More actions");

  return (
    // The wrapper is what the group lays out, so it is what the group measures.
    <Popover {...{ [TOOLBAR_OVERFLOW_ATTRIBUTE]: true }}>
      <PopoverButton
        appearance="weak"
        aria-haspopup="menu"
        aria-label={label}
        brand="neutral"
        data-testid="toolbar-overflow"
        leftIconPath={mdiDotsHorizontal}
      />

      <PopoverPanel className="nxm-toolbar-overflow">
        {({ close }) => <ToolbarOverflowMenu actions={actions} label={label} onSelect={close} />}
      </PopoverPanel>
    </Popover>
  );
};
