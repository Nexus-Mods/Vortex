import { ListboxOptions as HeadlessListboxOptions } from "@headlessui/react";
import React, { type ComponentProps } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export const ListboxOptions = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessListboxOptions>) => (
  <HeadlessListboxOptions
    anchor={{ gap: 4, to: "bottom end" }}
    as="div"
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);
