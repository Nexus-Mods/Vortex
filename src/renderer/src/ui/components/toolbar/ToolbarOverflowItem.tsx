import { PopoverButton } from "@headlessui/react";
import React, { forwardRef, type KeyboardEvent } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IToolbarAction, IToolbarPanel } from "./ToolbarGroup";

interface IToolbarOverflowItemProps {
  action: IToolbarAction;
  tabIndex: number;
  onSelect: () => void;
}

const ToolbarOverflowItemContent = ({ action }: { action: IToolbarAction }) => (
  <>
    {!!action.iconPath && (
      <Icon className="nxm-dropdown-item-icon" path={action.iconPath} size="none" />
    )}

    <span className="nxm-dropdown-item-label">{action.label}</span>
  </>
);

/**
 * A row whose panel opens beside it, leaving the menu itself open — the panel is
 * portalled, but Headless UI registers it as part of the enclosing popover, so
 * reaching into it doesn't read as leaving the menu.
 */
const ToolbarOverflowPanelItem = forwardRef<
  HTMLButtonElement,
  { action: IToolbarAction; disabled: boolean; panel: IToolbarPanel; tabIndex: number }
>(({ action, disabled, panel, tabIndex }, ref) => (
  <Popover className="flex flex-col">
    {({ open }) => (
      <>
        <PopoverButton
          aria-haspopup="dialog"
          className={joinClasses("nxm-dropdown-item", { "nxm-dropdown-item-active": open })}
          disabled={disabled}
          ref={ref}
          role="menuitem"
          tabIndex={tabIndex}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key !== "ArrowRight") {
              return;
            }

            // Ahead of Headless UI's own handler, which is skipped once this is defaulted.
            event.preventDefault();
            event.currentTarget.click();
          }}
        >
          <ToolbarOverflowItemContent action={action} />
        </PopoverButton>

        <PopoverPanel anchor={{ gap: 8, to: "right start" }} className="nxm-popover-panel-dropdown">
          {({ close }) => <>{panel({ close })}</>}
        </PopoverPanel>
      </>
    )}
  </Popover>
));

ToolbarOverflowPanelItem.displayName = "ToolbarOverflowPanelItem";

/**
 * One row of a {@link ToolbarOverflow} menu. A plain action runs and dismisses
 * the menu; one with a panel opens it alongside instead.
 */
export const ToolbarOverflowItem = forwardRef<HTMLButtonElement, IToolbarOverflowItemProps>(
  ({ action, tabIndex, onSelect }, ref) => {
    const disabled = !!action.disabled || !!action.isLoading;

    if (action.panel) {
      return (
        <ToolbarOverflowPanelItem
          action={action}
          disabled={disabled}
          panel={action.panel}
          ref={ref}
          tabIndex={tabIndex}
        />
      );
    }

    return (
      <button
        className="nxm-dropdown-item"
        disabled={disabled}
        ref={ref}
        role="menuitem"
        tabIndex={tabIndex}
        type="button"
        onClick={() => {
          action.onClick?.();
          onSelect();
        }}
      >
        <ToolbarOverflowItemContent action={action} />
      </button>
    );
  },
);

ToolbarOverflowItem.displayName = "ToolbarOverflowItem";
