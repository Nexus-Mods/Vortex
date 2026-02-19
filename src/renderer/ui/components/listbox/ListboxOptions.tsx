import { Listbox as HeadlessListbox } from "@headlessui/react";
import { type ComponentProps } from "react";

import { joinClasses } from "../../utils/joinClasses";

export const ListboxOptions = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessListbox.Options>) => (
  <HeadlessListbox.Options
    as="div"
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);
