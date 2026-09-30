import React, { forwardRef } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Switch, type ISwitchProps } from "@/ui/components/form/switch/Switch";
import { joinClasses } from "@/ui/utils/joinClasses";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-toggle.
export type ISwitchFieldProps = Omit<ISwitchProps, "id"> & {
  /** Names the switch. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Help text under the switch and label, one line per hint. */
  hints?: string | string[];
  /** Classes for the field around the switch; `className` goes on the switch itself. */
  fieldClassName?: string;
};

/** A switch with its label beside it and hints under both. Clicking the label toggles it. */
export const SwitchField = forwardRef<HTMLSpanElement, ISwitchFieldProps>(
  ({ disabled, fieldClassName, hideLabel = false, hints = [], label, ...props }, ref) => {
    const hintList = Array.isArray(hints) ? hints : [hints];

    return (
      <Field className={joinClasses(["nxm-switch-field", fieldClassName])} disabled={disabled}>
        <div className="nxm-field-control">
          <Switch {...props} ref={ref} />

          <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
        </div>

        {hintList.map((hint) => (
          <Description key={hint}>{hint}</Description>
        ))}
      </Field>
    );
  },
);
