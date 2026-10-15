import { ListboxButton as HeadlessListboxButton } from "@headlessui/react";
import React from "react";

import { Button, type IButtonProps } from "@/ui/components/button/Button";

export type IListboxButtonProps = IButtonProps & {
  showChevron?: boolean;
};

export const ListboxButton = ({ showChevron = true, ...props }: IListboxButtonProps) => (
  <HeadlessListboxButton
    appearance="moderate"
    as={Button}
    brand="neutral"
    rightIcon={showChevron ? "unfold_more" : undefined}
    size="sm"
    {...props}
  />
);
