import React, { forwardRef } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Select, type ISelectProps } from "@/ui/components/form/select/Select";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-focus.
export type ISelectFieldProps = Omit<ISelectProps, "id" | "invalid"> & {
  /** Names the select. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Marks the select invalid and says why. */
  errorMessage?: string;
  /** Keeps the error off screen, for layouts with no room for it; screen readers still get it. */
  hideErrors?: boolean;
  /** Help text under the select, one line per hint. */
  hints?: string | string[];
  /** Shows "(Required)" on the label. Defaults to `required`. */
  showRequiredLabel?: boolean;
  /** Classes for the field around the select; `className` goes on the select itself. */
  fieldClassName?: string;
};

/** A select with its label, hints and error. */
export const SelectField = forwardRef<HTMLSelectElement, ISelectFieldProps>(
  (
    {
      disabled,
      errorMessage,
      fieldClassName,
      hideErrors = false,
      hideLabel = false,
      hints = [],
      label,
      required,
      showRequiredLabel,
      ...props
    },
    ref,
  ) => {
    const hintList = Array.isArray(hints) ? hints : [hints];
    const showError = !!errorMessage && !hideErrors;

    return (
      <Field className={fieldClassName} disabled={disabled}>
        <Label
          className={hideLabel ? "sr-only" : undefined}
          required={showRequiredLabel ?? required}
        >
          {label}
        </Label>

        <Select {...props} invalid={!!errorMessage} ref={ref} required={required} />

        {!!errorMessage && hideErrors && (
          <ErrorMessage className="sr-only">{errorMessage}</ErrorMessage>
        )}

        {(showError || !!hintList.length) && (
          <div className="nxm-field-footer">
            <div className="nxm-field-messages">
              {showError && <ErrorMessage>{errorMessage}</ErrorMessage>}

              {hintList.map((hint) => (
                <Description key={hint}>{hint}</Description>
              ))}
            </div>
          </div>
        )}
      </Field>
    );
  },
);
