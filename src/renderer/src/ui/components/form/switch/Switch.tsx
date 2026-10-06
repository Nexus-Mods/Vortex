import { Checkbox } from "@headlessui/react";
import React, { type ComponentProps, forwardRef } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * Switch — a tri-state switch: `off`, `on`, and `semi-on` (a "mixed" state set
 * programmatically, e.g. a master control whose children are partially on).
 * Clicking only ever flips between on and off; semi-on is never reached by user
 * interaction.
 *
 * Built on Headless UI's `Checkbox` rather than its `Switch`, because ARIA only
 * allows `aria-checked` to be true/false on `role="switch"` — a switch is binary
 * by definition, and Headless UI controls that attribute so `mixed` can't be
 * forced onto it. A tri-state master control is the checkbox pattern, and
 * `Checkbox` reports `indeterminate` as `aria-checked="mixed"`.
 *
 * The visible track and thumb are styled off the `data-checked`,
 * `data-indeterminate`, `data-disabled`, `data-hover`, `data-active` and
 * `data-focus` attributes Headless UI sets from its own state.
 */
export type ISwitchProps = Omit<ComponentProps<typeof Checkbox>, "className"> & {
  className?: string;
  /** Renders the "semi-on" state and reports `aria-checked="mixed"`. */
  indeterminate?: boolean;
  /** Shows a change under way, as `aria-busy`, and ignores clicks until it's done. */
  isLoading?: boolean;
};

/**
 * The bare switch. Inside a `Field` it's named by the field's `Label`; on its own it needs an
 * `aria-label`. For a switch with its label and hints, use `SwitchField`.
 */
export const Switch = forwardRef<HTMLSpanElement, ISwitchProps>(
  ({ className, isLoading = false, onChange, ...props }, ref) => (
    <Checkbox
      aria-busy={isLoading || undefined}
      className={joinClasses(["nxm-switch", className])}
      data-loading={isLoading ? "" : undefined}
      ref={ref}
      onChange={isLoading ? undefined : onChange}
      {...props}
    >
      <span className="nxm-switch-thumb" />
    </Checkbox>
  ),
);
