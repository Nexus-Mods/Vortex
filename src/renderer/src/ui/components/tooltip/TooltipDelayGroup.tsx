import { FloatingDelayGroup } from "@floating-ui/react";
import React, { type ElementType, type HTMLAttributes, type ReactNode } from "react";

import type { ITooltipDelay } from "@/ui/components/tooltip/Tooltip";

interface ITooltipDelayGroupProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
  /** Shared hover delays in ms. A single number sets both open and close. */
  delay?: ITooltipDelay;
}

/**
 * Shares one hover delay across every `Tooltip` inside. The first waits; while
 * one is showing, moving to a sibling swaps straight over. Wrap rows of icons.
 *
 * Renders no DOM of its own. Where the row needs a layout element anyway, pass
 * `as` and its props so the group and that element are one node, not two.
 */
export const TooltipDelayGroup = ({
  as: Wrapper,
  children,
  delay = { close: 50, open: 250 },
  ...props
}: ITooltipDelayGroupProps) => (
  <FloatingDelayGroup delay={delay}>
    {Wrapper ? <Wrapper {...props}>{children}</Wrapper> : children}
  </FloatingDelayGroup>
);
