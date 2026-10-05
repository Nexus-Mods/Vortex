import { Field, Label } from "@headlessui/react";
import React, { type PropsWithChildren } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * One row of a `PopoverPanelGroup`: a label on the left and its control on the
 * right, with the label truncating rather than wrapping. Leave `label` off for a
 * row that is only a control — a reset link, say — and place it with a
 * `justify-*` class.
 *
 * With a `label` the row is a Headless UI `Field`, so the label names a Headless UI
 * control (`Switch`, `Picker`) and clicking it reaches the control. A native control
 * isn't linked this way and still needs its own `aria-label`.
 *
 * Set `passive` when clicking the label has nothing useful to do, as with a `Picker`,
 * which it would only focus: the label still names the control but ignores clicks.
 */
export const PopoverPanelGroupItem = ({
  children,
  className,
  label,
  passive = false,
}: PropsWithChildren<{ className?: string; label?: string; passive?: boolean }>) => {
  const classes = joinClasses(["nxm-popover-panel-group-item", className]);

  if (!label) {
    return <div className={classes}>{children}</div>;
  }

  return (
    <Field className={classes}>
      <Label className="nxm-popover-panel-group-item-label" passive={passive}>
        {label}
      </Label>

      {children}
    </Field>
  );
};
