import { mdiCheck, mdiChevronRight, mdiPinOffOutline, mdiPinOutline } from "@mdi/js";
import React from "react";

import { Icon } from "@/ui/components/icon/Icon";
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
        iconPath={action.control.iconPath}
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
        iconPath={action.pin.pinned ? mdiPinOffOutline : mdiPinOutline}
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
        path={mdiCheck}
        size="none"
      />
    )}

    {(hasPanel || reservesChevron) && (
      <Icon
        className={joinClasses("nxm-dropdown-item-icon", {
          "nxm-dropdown-item-chevron-hidden": !hasPanel,
        })}
        path={mdiChevronRight}
        size="none"
      />
    )}
  </>
);
