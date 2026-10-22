import { Radio as HeadlessRadio, type RadioProps } from "@headlessui/react";
import React, { forwardRef } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type IRadioProps = Omit<RadioProps<"span", string>, "className"> & {
  /** Classes for the radio, added to its base ones. */
  className?: string;
};

/**
 * A bare radio. It belongs inside a Headless UI `RadioGroup`, which holds the chosen value and
 * moves between radios with the arrow keys. Inside a `Field` it's named by the field's `Label`; on
 * its own it needs an `aria-label`. For a group of radios with their labels and hints, use
 * `RadioGroupField`.
 *
 * It renders a `<span role="radio">`, so pass `value` for the group to choose it by.
 */
export const Radio = forwardRef<HTMLSpanElement, IRadioProps>(({ className, ...props }, ref) => (
  <HeadlessRadio className={joinClasses(["nxm-radio", className])} ref={ref} {...props} />
));
