import React from "react";

import { Icon, symbolProps } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IMenuAction } from "./PopoverMenu.types";
import { PopoverMenuItemControl } from "./PopoverMenuItemControl";

/**
 * What a row shows, either kind: its icon and label, then its control and pin, its check
 * while it's one of a choice, and its chevron, or the room for one.
 */
export const PopoverMenuItemContent = ({
  action,
  hasPanel = false,
  hasFocus,
  reservesChevron,
  onSelect,
}: {
  action: IMenuAction;
  hasPanel?: boolean;
  hasFocus: boolean;
  reservesChevron: boolean;
  onSelect: () => void;
}) => (
  <>
    {action.icon ? (
      <span className="nxm-dropdown-item-icon flex items-center justify-center">{action.icon}</span>
    ) : action.symbol ? (
      <Icon {...symbolProps(action.symbol)} className="nxm-dropdown-item-icon" size="none" />
    ) : (
      !!action.iconPath && (
        <Icon className="nxm-dropdown-item-icon" path={action.iconPath} size="none" />
      )
    )}

    <span className="nxm-dropdown-item-label">{action.label}</span>

    {!!action.control && (
      <PopoverMenuItemControl
        showTooltip
        hasFocus={hasFocus}
        label={action.control.label}
        symbol={action.control.symbol}
        onActivate={() => {
          action.control?.onClick();
          onSelect();
        }}
      />
    )}

    {!!action.pin && (
      <PopoverMenuItemControl
        hasFocus={hasFocus}
        label={action.pin.label}
        pressed={action.pin.pinned}
        symbol={action.pin.pinned ? "keep_off" : "keep"}
        onActivate={action.pin.onToggle}
      />
    )}

    {action.checked !== undefined && (
      <Icon
        className={joinClasses("nxm-dropdown-item-icon", {
          "nxm-dropdown-item-check-hidden": !action.checked,
        })}
        name="check"
        size="none"
      />
    )}

    {(hasPanel || reservesChevron) && (
      <Icon
        className={joinClasses("nxm-dropdown-item-icon", {
          "nxm-dropdown-item-chevron-hidden": !hasPanel,
        })}
        name="chevron_right"
        size="none"
      />
    )}
  </>
);
