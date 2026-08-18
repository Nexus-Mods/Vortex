import React, { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";
import { Tooltip, type ITooltipPlacement } from "@/ui/components/tooltip/Tooltip";

export type IToolbarButtonProps = IButtonProps & {
  /**
   * The control to render. Defaults to `Button`; pass `PopoverButton` for a
   * control that opens a panel. Anything that takes `IButtonProps` and forwards
   * its ref to the `button` will do.
   *
   * It has to go inside the tooltip rather than around it: Headless UI returns
   * focus to its button after a click, and a tooltip nested within one reads
   * that as a reason to reopen — over the panel the same click just opened.
   */
  as?: ForwardRefExoticComponent<IButtonProps & RefAttributes<HTMLButtonElement>>;
  label: string;
  showLabel?: boolean;
  placement?: ITooltipPlacement;
  /**
   * Holds the tooltip back while the control has already said what it does some
   * other way — a panel it just opened, which the tooltip would otherwise cover.
   */
  tooltipDisabled?: boolean;
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
 * becomes a row in the overflow menu, which shows its label as text and needs no
 * tooltip.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, IToolbarButtonProps>(
  (
    {
      as: Control = Button,
      label,
      placement = "bottom",
      showLabel = false,
      tooltipDisabled = false,
      ...props
    },
    ref,
  ) => (
    <Tooltip content={label} disabled={showLabel || tooltipDisabled} placement={placement}>
      <Control {...props} aria-label={showLabel ? undefined : label} ref={ref}>
        {showLabel && label}
      </Control>
    </Tooltip>
  ),
);

ToolbarButton.displayName = "ToolbarButton";
