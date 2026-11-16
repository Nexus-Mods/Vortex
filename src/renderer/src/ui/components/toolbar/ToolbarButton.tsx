import React, {
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";
import { Tooltip, type ITooltipPlacement } from "@/ui/components/tooltip/Tooltip";

export type IToolbarButtonProps = IButtonProps & {
  /** The control, `Button` by default; it sits inside the tooltip so focus can't reopen it. */
  as?: ForwardRefExoticComponent<IButtonProps & RefAttributes<HTMLButtonElement>>;
  /** What it does: its tooltip, accessible name, and text when `showLabel` is set. */
  label: string;
  /** Said under the label in the tooltip, and as the control's accessible description. */
  description?: string;
  /** Turns it off but keeps it hoverable; this is its tooltip and description, labelled or not. */
  disabledReason?: string;
  /** Shows the label as text beside the icon, in place of the tooltip. */
  showLabel?: boolean;
  /** Where the tooltip sits; below by default. */
  placement?: ITooltipPlacement;
  /** Hides the tooltip while something else says what it does, such as its open panel. */
  tooltipDisabled?: boolean;
};

/** A tooltip's bold title over what it means, as the design words these: 240px wide. */
const TitledTooltip = ({ title, body }: { title: string; body: string }) => (
  <div className="nxm-tooltip-content max-w-60">
    <p className="font-semibold">{title}</p>

    <p>{body}</p>
  </div>
);

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
      description,
      disabledReason,
      label,
      placement = "bottom",
      showLabel = false,
      tooltipDisabled = false,
      ...props
    },
    ref,
  ) => {
    let tooltipProps: { content: string } | { customContent: ReactNode } = { content: label };
    if (disabledReason) {
      tooltipProps = { content: disabledReason };
    } else if (description !== undefined) {
      tooltipProps = { customContent: <TitledTooltip body={description} title={label} /> };
    }

    return (
      <Tooltip
        disabled={(showLabel && !disabledReason) || tooltipDisabled}
        placement={placement}
        {...tooltipProps}
      >
        <Control
          {...props}
          aria-description={disabledReason ?? description}
          aria-disabled={disabledReason ? true : props["aria-disabled"]}
          aria-label={showLabel ? undefined : label}
          ref={ref}
          onClick={disabledReason ? undefined : props.onClick}
        >
          {showLabel && label}
        </Control>
      </Tooltip>
    );
  },
);

ToolbarButton.displayName = "ToolbarButton";
