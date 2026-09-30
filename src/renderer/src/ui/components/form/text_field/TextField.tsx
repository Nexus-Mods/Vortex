import React, { forwardRef, useState } from "react";

import { CharacterCount } from "@/ui/components/form/field/CharacterCount";
import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Input, type IInputProps } from "@/ui/components/form/input/Input";
import { Icon } from "@/ui/components/icon/Icon";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-focus.
export type ITextFieldProps = Omit<IInputProps, "id" | "invalid"> & {
  /** Names the input. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Marks the input invalid and says why. */
  errorMessage?: string;
  /** Keeps the error off screen, for layouts with no room for it; screen readers still get it. */
  hideErrors?: boolean;
  /** Help text under the input, one line per hint. */
  hints?: string | string[];
  /** Shows "(Required)" on the label. Defaults to `required`. */
  showRequiredLabel?: boolean;
  /** Classes for the field around the input; `className` goes on the input itself. */
  fieldClassName?: string;
  /** An mdi icon path drawn inside the input, before the text. */
  leftIconPath?: string;
};

/** A text input with its label, hints, error and, given `maxLength`, a character count. */
export const TextField = forwardRef<HTMLInputElement, ITextFieldProps>(
  (
    {
      defaultValue,
      disabled,
      errorMessage,
      fieldClassName,
      hideErrors = false,
      hideLabel = false,
      hints = [],
      label,
      leftIconPath,
      maxLength,
      required,
      showRequiredLabel,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const hintList = Array.isArray(hints) ? hints : [hints];
    const [typedLength, setTypedLength] = useState(String(defaultValue ?? "").length);
    // A controlled value can change without a keystroke, so count it rather than the typing.
    const length = value !== undefined ? String(value).length : typedLength;
    const showError = !!errorMessage && !hideErrors;

    return (
      <Field className={fieldClassName} disabled={disabled}>
        <Label
          className={hideLabel ? "sr-only" : undefined}
          required={showRequiredLabel ?? required}
        >
          {label}
        </Label>

        <div className="nxm-field-control">
          {!!leftIconPath && <Icon className="nxm-input-icon" path={leftIconPath} size="sm" />}

          <Input
            {...props}
            defaultValue={defaultValue}
            invalid={!!errorMessage}
            maxLength={maxLength}
            ref={ref}
            required={required}
            value={value}
            onChange={(event) => {
              setTypedLength(event.target.value.length);
              onChange?.(event);
            }}
          />
        </div>

        {!!errorMessage && hideErrors && (
          <ErrorMessage className="sr-only">{errorMessage}</ErrorMessage>
        )}

        {(showError || !!hintList.length || maxLength !== undefined) && (
          <div className="nxm-field-footer">
            <div className="nxm-field-messages">
              {showError && <ErrorMessage>{errorMessage}</ErrorMessage>}

              {hintList.map((hint) => (
                <Description key={hint}>{hint}</Description>
              ))}
            </div>

            {maxLength !== undefined && <CharacterCount length={length} maxLength={maxLength} />}
          </div>
        )}
      </Field>
    );
  },
);
