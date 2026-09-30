import { Checkbox as HeadlessCheckbox } from "@headlessui/react";
import { mdiCheck, mdiMinus } from "@mdi/js";
import React, { type ComponentProps, forwardRef } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export type ICheckboxProps = Omit<ComponentProps<typeof HeadlessCheckbox>, "className"> & {
  className?: string;
  /** Shows a dash instead of a tick and reports `aria-checked="mixed"`. */
  indeterminate?: boolean;
  /** Marks the checkbox invalid, as `aria-invalid` and `data-invalid`. */
  invalid?: boolean;
};

/**
 * A bare checkbox. Inside a `Field` it's named by the field's `Label`; on its own it needs an
 * `aria-label`. For a checkbox with its label, hints and error, use `CheckboxField`.
 *
 * It renders a `<span role="checkbox">`, so pass `name` for the value to take part in form
 * submission. `onChange` receives the new checked value, not an event.
 */
export const Checkbox = forwardRef<HTMLSpanElement, ICheckboxProps>(
  ({ className, invalid = false, ...props }, ref) => (
    <HeadlessCheckbox
      aria-invalid={invalid || undefined}
      className={joinClasses(["nxm-checkbox", className])}
      data-invalid={invalid ? "" : undefined}
      ref={ref}
      {...props}
    >
      <Icon className="nxm-checkbox-icon nxm-checkbox-icon-check" path={mdiCheck} size="none" />

      <Icon
        className="nxm-checkbox-icon nxm-checkbox-icon-indeterminate"
        path={mdiMinus}
        size="none"
      />
    </HeadlessCheckbox>
  ),
);
