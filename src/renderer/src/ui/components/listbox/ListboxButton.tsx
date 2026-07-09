import { Listbox as HeadlessListbox } from "@headlessui/react";
import { mdiUnfoldMoreHorizontal } from "@mdi/js";
import React from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IListboxButtonProps = IButtonProps & {
  showChevron?: boolean;
};

export const ListboxButton = ({ showChevron = true, ...props }: IListboxButtonProps) => (
  <HeadlessListbox.Button
    appearance="moderate"
    as={Button}
    brand="neutral"
    rightIconPath={showChevron ? mdiUnfoldMoreHorizontal : undefined}
    size="sm"
    {...props}
  />
);
