import React, { forwardRef } from "react";

import { dropdownItemBrandClass } from "@/ui/components/dropdown/dropdownItemBrand";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IPopoverMenuItemProps } from "./PopoverMenu.types";
import { PopoverMenuItemContent } from "./PopoverMenuItemContent";
import { PopoverMenuPanelItem } from "./PopoverMenuPanelItem";
import { takeFocus } from "./takeFocus";

/**
 * One row of a {@link PopoverMenu}. A plain action runs and dismisses the menu;
 * one with a panel opens it alongside instead.
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
        aria-checked={action.checked}
        aria-disabled={keepsPin || undefined}
        className={joinClasses(["nxm-dropdown-item", dropdownItemBrandClass(action.brand)], {
          "nxm-dropdown-item-focus": hasFocus,
        })}
        disabled={disabled && !keepsPin}
        ref={ref}
        role={action.checked === undefined ? "menuitem" : "menuitemradio"}
        tabIndex={tabIndex}
        type="button"
        onClick={() => {
          if (keepsPin) {
            return;
          }
          action.onClick?.();
          onSelect();
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
