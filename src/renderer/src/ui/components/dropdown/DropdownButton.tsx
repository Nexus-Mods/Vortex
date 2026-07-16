import { Menu } from "@headlessui/react";
import React from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IDropdownButtonProps = IButtonProps;

export const DropdownButton = (props: IDropdownButtonProps) => (
  <Menu.Button as={Button} {...props} />
);
