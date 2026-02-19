import { Listbox as HeadlessListbox } from "@headlessui/react";
import { mdiUnfoldMoreHorizontal } from "@mdi/js";
import React, { type ComponentProps } from "react";

import { Icon } from "../next/icon";
import { joinClasses } from "../next/utils";

export const ListboxButton = ({
  children,
  className,
  showChevron = true,
  ...props
}: ComponentProps<typeof HeadlessListbox.Button> & {
  showChevron?: boolean;
}) => (
  <HeadlessListbox.Button
    className={joinClasses(["nxm-dropdown-button", className])}
    {...props}
  >
    {!!children && <span>{children}</span>}

    {showChevron && (
      <Icon
        className="nxm-dropdown-button-icon"
        path={mdiUnfoldMoreHorizontal}
        size="none"
      />
    )}
  </HeadlessListbox.Button>
);
