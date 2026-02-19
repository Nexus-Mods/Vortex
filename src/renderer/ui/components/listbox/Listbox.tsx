import { Listbox as HeadlessListbox } from "@headlessui/react";
import { type ComponentProps } from "react";

import { joinClasses } from "../../utils/join_classes";

export const Listbox = ({
  className,
  ...props
}: ComponentProps<typeof HeadlessListbox>) => (
  <HeadlessListbox
    as="div"
    className={joinClasses(["nxm-dropdown", className])}
    {...props}
  />
);
