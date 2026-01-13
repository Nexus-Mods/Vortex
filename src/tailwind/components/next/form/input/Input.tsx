/**
 * Input Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent input component with validation, hints, and accessibility features.
 */

import * as React from "react";
import type { InputHTMLAttributes, Ref } from "react";
import { useState } from "react";

import type { BaseFormFieldProps } from "../formfield";
import { FormField } from "../formfield";
import { joinClasses } from "../../utils";

export interface InputProps
  extends BaseFormFieldProps,
    InputHTMLAttributes<HTMLInputElement> {
  /**
   * Restrict default value to string | number as we don't use this component for checkbox
   */
  defaultValue?: string | number;
  fieldClassName?: string;
  ref?: Ref<HTMLInputElement>;
  type?: "text" | "email" | "password" | "url" | "number" | "time" | "date";
  /**
   * Restrict value to string | number as we don't use this component for checkbox
   */
  value?: string | number;
}

export const Input = ({
  className,
  defaultValue,
  disabled,
  errorMessage,
  fieldClassName,
  hideLabel = false,
  hints = [],
  hintsTypographyType,
  id,
  label = "",
  maxLength,
  onChange = () => null,
  readOnly,
  required,
  showRequiredLabel,
  type = "text",
  value,
  ...props
}: InputProps) => {
  const trimToMaxLength = (val?: InputProps["value"]) =>
    maxLength ? val?.toString().substring(0, maxLength) : val?.toString();

  const [inputLength, setInputLength] = useState(
    trimToMaxLength(value ?? defaultValue)?.length ?? 0,
  );

  // Make sure hints is always an array
  hints = !Array.isArray(hints) ? [hints] : hints;

  return (
    <FormField
      className={fieldClassName}
      disabled={disabled}
      errorMessage={errorMessage}
      hideLabel={hideLabel}
      hints={hints}
      hintsTypographyType={hintsTypographyType}
      id={id}
      inputLength={inputLength}
      label={label}
      maxLength={maxLength}
      showRequiredLabel={showRequiredLabel ?? required}
    >
      <input
        {...props}
        aria-describedby={
          !!errorMessage
            ? `${id}_error`
            : hints.length > 0
              ? `${id}_hints`
              : undefined
        }
        aria-invalid={!!errorMessage || undefined}
        className={joinClasses(
          [
            "tw:text-neutral-strong tw:typography-body-lg tw:placeholder:text-neutral-subdued tw:min-h-9 tw:rounded tw:border tw:px-3 tw:transition-colors",
            ...(typeof errorMessage === "string"
              ? ["tw:bg-surface-translucent-mid tw:border-danger-strong"]
              : [
                  "tw:bg-translucent-dark-400 tw:border-stroke-subdued",
                  ...(readOnly || disabled
                    ? [""]
                    : [
                        "tw:focus:bg-surface-translucent-mid tw:focus:border-stroke-strong",
                        "tw:hover:bg-surface-translucent-low tw:hover:border-stroke-moderate",
                      ]),
                ]),
            className,
          ],
          { "tw:opacity-40 tw:outline-none": readOnly || disabled },
        )}
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value}
        onChange={(e) => {
          if (maxLength) {
            setInputLength(e.target.value.length);
          }
          onChange(e);
        }}
      />
    </FormField>
  );
};
