import React, { forwardRef } from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";
import { Tooltip, type ITooltipPlacement } from "@/ui/components/tooltip/Tooltip";

export type IToolbarButtonProps = IButtonProps & {
  label: string;
  showLabel?: boolean;
  placement?: ITooltipPlacement;
};

/**
 * A toolbar control: an icon-only `Button` whose label is shown on hover.
 *
 * Toolbar controls carry no visible text, so the tooltip is the only on-screen
 * hint of what they do. `label` is the single source for that, for the accessible
 * name, and for the text when `showLabel` is set — where the name is already on
 * screen, so the tooltip steps aside instead of repeating it.
 *
 * Only for the slots a `ToolbarGroup` renders as buttons. An overflowed action
 * becomes a `DropdownItem`, which shows its label as text and needs no tooltip.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, IToolbarButtonProps>(
  ({ label, placement = "bottom", showLabel = false, ...props }, ref) => (
    <Tooltip content={label} disabled={showLabel} placement={placement}>
      <Button {...props} aria-label={showLabel ? undefined : label} ref={ref} size="sm">
        {showLabel && label}
      </Button>
    </Tooltip>
  ),
);

ToolbarButton.displayName = "ToolbarButton";
