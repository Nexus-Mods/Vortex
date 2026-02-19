import { Listbox as HeadlessListbox } from "@headlessui/react";
import { mdiCheck } from "@mdi/js";
import React, { type ComponentProps, Fragment, type ReactNode } from "react";

import { joinClasses } from "../../utils/join_classes";
import type { XOr } from "../../utils/types";
import { Icon } from "../icon";

export type IListboxOption<T = unknown> = ComponentProps<
  typeof HeadlessListbox.Option
> & {
  label: string;
  value: T;
} & XOr<{ iconPath?: string }, { icon?: ReactNode }>;

export const ListboxOption = ({
  className,
  icon,
  iconPath,
  label,
  ...props
}: IListboxOption) => (
  <HeadlessListbox.Option as={Fragment} {...props}>
    {({ active, selected }) => (
      <div
        className={joinClasses(["nxm-dropdown-item", className], {
          "nxm-dropdown-item-active": active,
        })}
      >
        {icon && (
          <span className="nxm-dropdown-item-icon flex items-center justify-center">
            {icon}
          </span>
        )}

        {iconPath && (
          <Icon
            className="nxm-dropdown-item-icon"
            path={iconPath}
            size="none"
          />
        )}

        <span className="nxm-dropdown-item-label">{label}</span>

        {selected && (
          <Icon
            className="nxm-dropdown-item-icon"
            path={mdiCheck}
            size="none"
          />
        )}
      </div>
    )}
  </HeadlessListbox.Option>
);
