import { Listbox as HeadlessListbox } from "@headlessui/react";
import { type ComponentProps } from "react";

import { joinClasses } from "../next/utils";

export const ListboxOption = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessListbox.Option>) => (
  <HeadlessListbox.Option
    as="button"
    className={joinClasses(["nxm-listbox-option", className])}
    {...props}
  />
);
