import { Popover as HeadlessPopover } from "@headlessui/react";
import React from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IPopoverButtonProps = IButtonProps;

/**
 * Popover trigger button. Renders a Button as the Headless UI `Popover.Button`,
 * so it takes all the same props as Button. Place it inside a `Popover`
 * alongside a `PopoverPanel`.
 */
export const PopoverButton = (props: IPopoverButtonProps) => (
  <HeadlessPopover.Button as={Button} {...props} />
);
