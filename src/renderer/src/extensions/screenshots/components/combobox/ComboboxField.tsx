import React, { type ReactNode } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";

import { Combobox, type IComboboxProps } from "./Combobox";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-focus.
export type IComboboxFieldProps<T> = Omit<IComboboxProps<T>, "id"> & {
  /** The input and options panel. */
  children: ReactNode;
  /** Names the combobox. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Marks the combobox invalid and says why. */
  errorMessage?: string;
  /** Keeps the error off screen, for layouts with no room for it; screen readers still get it. */
  hideErrors?: boolean;
  /** Help text under the combobox, one line per hint. */
  hints?: string | string[];
  /** Shows "(Required)" on the label. */
  showRequiredLabel?: boolean;
  /** Classes for the field around the combobox; `className` goes on the combobox itself. */
  fieldClassName?: string;
};

/** A combobox with its label, hints and error. */
export const ComboboxField = <T,>({
  children,
  disabled,
  errorMessage,
  fieldClassName,
  hideErrors = false,
  hideLabel = false,
  hints = [],
  label,
  showRequiredLabel,
  ...props
}: IComboboxFieldProps<T>) => {
  const hintList = Array.isArray(hints) ? hints : [hints];
  const showError = !!errorMessage && !hideErrors;

  return (
    <Field className={fieldClassName} disabled={disabled}>
      <Label className={hideLabel ? "sr-only" : undefined} required={showRequiredLabel}>
        {label}
      </Label>

      <Combobox {...props} disabled={disabled}>
        {children}
      </Combobox>

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
};
