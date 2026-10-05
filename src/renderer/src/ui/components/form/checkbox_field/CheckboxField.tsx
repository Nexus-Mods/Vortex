import React, { forwardRef, type ReactNode } from "react";

import { Checkbox, type ICheckboxProps } from "@/ui/components/form/checkbox/Checkbox";
import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { joinClasses } from "@/ui/utils/joinClasses";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-toggle.
export type ICheckboxFieldProps = Omit<ICheckboxProps, "id" | "invalid"> & {
  /**
   * Names the checkbox, and can be rich content such as a title and a note. Always needed:
   * `hideLabel` hides it on screen, not from screen readers.
   */
  label: ReactNode;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Marks the checkbox invalid and says why. */
  errorMessage?: string;
  /** Help text under the checkbox and label, one line per hint. */
  hints?: string | string[];
  /** Classes for the field around the checkbox; `className` goes on the checkbox itself. */
  fieldClassName?: string;
};

/** A checkbox with its label beside it, and hints and error under both. Clicking the label toggles it. */
export const CheckboxField = forwardRef<HTMLSpanElement, ICheckboxFieldProps>(
  (
    { disabled, errorMessage, fieldClassName, hideLabel = false, hints = [], label, ...props },
    ref,
  ) => {
    const hintList = Array.isArray(hints) ? hints : [hints];

    return (
      <Field className={joinClasses(["nxm-checkbox-field", fieldClassName])} disabled={disabled}>
        <div className="nxm-field-control">
          <Checkbox {...props} invalid={!!errorMessage} ref={ref} />

          <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
        </div>

        {!!errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}

        {hintList.map((hint) => (
          <Description key={hint}>{hint}</Description>
        ))}
      </Field>
    );
  },
);
