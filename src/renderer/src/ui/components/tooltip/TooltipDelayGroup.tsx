import { FloatingDelayGroup } from "@floating-ui/react";
import React, { type ReactNode } from "react";

import type { ITooltipDelay } from "@/ui/components/tooltip/Tooltip";

interface ITooltipDelayGroupProps {
  children?: ReactNode;
  /** Shared hover delays in ms. A single number sets both open and close. */
  delay?: ITooltipDelay;
}

/**
 * Shares one hover delay across every `Tooltip` inside. The first waits; while
 * one is showing, moving to a sibling swaps straight over. Wrap rows of icons.
 */
export const TooltipDelayGroup = ({
  children,
  delay = { close: 150, open: 300 },
}: ITooltipDelayGroupProps) => <FloatingDelayGroup delay={delay}>{children}</FloatingDelayGroup>;
