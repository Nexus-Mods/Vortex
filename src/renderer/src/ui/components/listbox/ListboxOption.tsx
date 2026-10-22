import { ListboxOption as HeadlessListboxOption } from "@headlessui/react";
import React, { type ComponentProps, Fragment } from "react";

import { Icon, IconSlot, type IIconProp } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export type IListboxOption<T = unknown> = ComponentProps<typeof HeadlessListboxOption> & {
  label: string;
  value: T;
  icon?: IIconProp;
};

export const ListboxOption = ({ className, icon, label, ...props }: IListboxOption) => (
  <HeadlessListboxOption as={Fragment} {...props}>
    {({ focus, selected }) => (
      <div
        className={joinClasses(["nxm-dropdown-item", className], {
          "nxm-dropdown-item-focus": focus,
        })}
      >
        <IconSlot className="nxm-dropdown-item-icon" icon={icon} />

        <span className="nxm-dropdown-item-label">{label}</span>

        {selected && <Icon className="nxm-dropdown-item-icon" name="check" size="none" />}
      </div>
    )}
  </HeadlessListboxOption>
);
