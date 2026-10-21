import React, { type KeyboardEvent, type SyntheticEvent } from "react";

import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

/**
 * A control within a row: its pin, or a button such as remove. Tabbable on the row the
 * keyboard is on rather than the row the menu keeps its own tab stop on (always
 * the first), so arrowing down and pressing Tab reaches the control of the row you are
 * actually on. Reaching for the row's `tabIndex` instead left every other row's control
 * unreachable, and Tab took focus out of the panel, closing the menu.
 */
export const PopoverMenuItemControl = ({
  hasFocus,
  icon,
  label,
  pressed,
  showTooltip = false,
  onActivate,
}: {
  /** Whether its row is the one the keyboard is on, which makes it tabbable. */
  hasFocus: boolean;
  /** Its icon. */
  icon: IIconSource;
  /** Its accessible name. */
  label: string;
  /** For a toggle, such as a pin: whether it's on. */
  pressed?: boolean;
  /** Shows its label in a tooltip, for a control the icon alone doesn't explain. */
  showTooltip?: boolean;
  /** Runs it, by click, Enter or Space, without running the row. */
  onActivate: () => void;
}) => {
  const activate = (event: SyntheticEvent) => {
    // The row would otherwise run what the row says: this is a control within it,
    // and activating it says only what it says.
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  };

  const control = (
    <span
      aria-label={label}
      aria-pressed={pressed}
      className="nxm-dropdown-item-pin"
      role="button"
      tabIndex={hasFocus ? 0 : -1}
      onClick={activate}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (["Enter", " "].includes(event.key)) {
          activate(event);
        }
      }}
    >
      <Icon {...getIconProps(icon)} size="none" />
    </span>
  );

  return showTooltip ? <Tooltip content={label}>{control}</Tooltip> : control;
};
