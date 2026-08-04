import { Popover as HeadlessPopover } from "@headlessui/react";
import React, { forwardRef } from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IPopoverButtonProps = IButtonProps;

/**
 * Popover trigger button. Renders a Button as the Headless UI `Popover.Button`,
 * so it takes all the same props as Button. Place it inside a `Popover`
 * alongside a `PopoverPanel`.
 *
 * The ref reaches the underlying `button`, so it can be a `Tooltip` trigger
 * directly.
 */
export const PopoverButton = forwardRef<HTMLButtonElement, IPopoverButtonProps>((props, ref) => (
  <HeadlessPopover.Button as={Button} ref={ref} {...props} />
));

PopoverButton.displayName = "PopoverButton";
