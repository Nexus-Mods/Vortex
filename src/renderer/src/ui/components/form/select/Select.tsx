import { Select as HeadlessSelect, type SelectProps } from "@headlessui/react";
import { mdiMenuDown } from "@mdi/js";
import React, { forwardRef } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export type ISelectProps = Omit<SelectProps<"select">, "className"> & {
  className?: string;
};

/**
 * A bare native select with its chevron. Inside a `Field` it's named by the field's `Label`; on
 * its own it needs an `aria-label`. For the usual label, hints and error in one, use `SelectField`.
 */
export const Select = forwardRef<HTMLSelectElement, ISelectProps>(
  ({ className, ...props }, ref) => (
    <div className="nxm-field-control">
      <HeadlessSelect className={joinClasses(["nxm-select", className])} ref={ref} {...props} />

      <Icon className="nxm-select-icon" path={mdiMenuDown} size="lg" />
    </div>
  ),
);
