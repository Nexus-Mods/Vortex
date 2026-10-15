import React from "react";

import { Icon, IconSlot } from "@/ui/components/icon/Icon";
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
    <IconSlot className="nxm-dropdown-item-icon" icon={action.icon} />

    <span className="nxm-dropdown-item-label">{action.label}</span>

    {!!action.control && (
      <PopoverMenuItemControl
        showTooltip
        hasFocus={hasFocus}
        icon={action.control.icon}
        label={action.control.label}
        onActivate={() => {
          action.control?.onClick();
          onSelect();
        }}
      />
    )}

    {!!action.pin && (
      <PopoverMenuItemControl
        hasFocus={hasFocus}
        icon={action.pin.pinned ? "keep_off" : "keep"}
        label={action.pin.label}
        pressed={action.pin.pinned}
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
