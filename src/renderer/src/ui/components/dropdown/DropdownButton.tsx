import { MenuButton } from "@headlessui/react";
import React, { forwardRef } from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IDropdownButtonProps = IButtonProps;

/** The button that opens a `Dropdown`, forwarding its ref so a `Tooltip` can wrap it. */
export const DropdownButton = forwardRef<HTMLButtonElement, IDropdownButtonProps>((props, ref) => (
  <MenuButton as={Button} ref={ref} {...props} />
));
