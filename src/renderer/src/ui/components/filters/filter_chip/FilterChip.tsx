import React from "react";

import type { IIconProp } from "@/ui/components/icon/Icon";
import type { IPopoverPanel } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";

interface IFilterChipProps {
  /** The filter's icon. */
  icon: IIconProp;
  /** What's on, in brief. */
  label: string;
  /** The × button's accessible name. */
  removeLabel: string;
  /** Takes the filter off. */
  onRemove: () => void;
  /** The filter's choices, which the chip opens. */
  panel: IPopoverPanel;
  /** Turns the chip off, such as while the filter's locked. */
  isDisabled?: boolean;
  /** Classes for the chip. */
  className?: string;
  /** A `data-testid` for the chip; its × gets the same with `-remove`. */
  testId?: string;
}

/** A filter's chip in a toolbar: what's on, opening its choices, with a × that takes it off. */
export const FilterChip = ({
  icon,
  label,
  removeLabel,
  onRemove,
  panel,
  isDisabled,
  className,
  testId,
}: IFilterChipProps) => (
  <SplitButton
    action={
      <SplitButtonAction
        data-testid={testId ? `${testId}-remove` : undefined}
        icon="close"
        label={removeLabel}
        onClick={onRemove}
      />
    }
    appearance="subdued"
    brand="neutral"
    className={className}
    data-testid={testId}
    isDisabled={isDisabled}
    leftIcon={icon}
    panel={panel}
    panelRole="menu"
    size="sm"
  >
    {label}
  </SplitButton>
);
