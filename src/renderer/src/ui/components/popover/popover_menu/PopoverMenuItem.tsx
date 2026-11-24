import React, { forwardRef } from "react";

import { dropdownItemBrandClass } from "@/ui/components/dropdown/dropdownItemBrand";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IPopoverMenuItemProps } from "./PopoverMenu.types";
import { PopoverMenuItemContent } from "./PopoverMenuItemContent";
import { PopoverMenuPanelItem } from "./PopoverMenuPanelItem";
import { takeFocus } from "./takeFocus";

/** The row's role: a checkbox, one of a choice, or a plain item. */
const roleOf = ({ checked, selected }: { checked?: boolean; selected?: boolean }) => {
  if (selected !== undefined) {
    return "menuitemcheckbox";
  }

  if (checked !== undefined) {
    return "menuitemradio";
  }

  return "menuitem";
};

/**
 * One row of a {@link PopoverMenu}. A plain action runs and dismisses the menu; a checkbox row
 * runs and leaves it open; one with a panel opens it alongside instead.
 */
export const PopoverMenuItem = forwardRef<HTMLButtonElement, IPopoverMenuItemProps>(
  ({ action, hasFocus, reservesChevron, tabIndex, onTakeFocus, onSelect }, ref) => {
    const disabled = !!action.disabled || !!action.isLoading;
    // A disabled row with a pin stays reachable, so it can still be pinned: only its action is off.
    const keepsPin = disabled && !!action.pin;

    if (action.panel) {
      return (
        <PopoverMenuPanelItem
          action={action}
          disabled={disabled}
          hasFocus={hasFocus}
          panel={action.panel}
          ref={ref}
          tabIndex={tabIndex}
          onSelect={onSelect}
          onTakeFocus={onTakeFocus}
        />
      );
    }

    return (
      <button
        aria-checked={action.selected ?? action.checked}
        aria-disabled={keepsPin || undefined}
        className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
          "nxm-dropdown-item-active": !!action.active,
          "nxm-dropdown-item-focus": hasFocus,
        })}
        data-testid={action.testId}
        disabled={disabled && !keepsPin}
        ref={ref}
        role={roleOf(action)}
        tabIndex={tabIndex}
        type="button"
        onClick={() => {
          if (keepsPin) {
            return;
          }
          action.onClick?.();
          if (action.selected === undefined) {
            onSelect();
          }
        }}
        onFocus={onTakeFocus}
        onMouseEnter={(event) => takeFocus(event.currentTarget)}
      >
        <PopoverMenuItemContent
          action={action}
          hasFocus={hasFocus}
          reservesChevron={reservesChevron}
          onSelect={onSelect}
        />
      </button>
    );
  },
);

PopoverMenuItem.displayName = "PopoverMenuItem";
