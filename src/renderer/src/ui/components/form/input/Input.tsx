/**
 * Input Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent input component with validation, hints, and accessibility features.
 */

import React, { useState, type InputHTMLAttributes, type Ref } from "react";

import type { IBaseFormFieldProps } from "@/ui/components/form/formfield/FormField";
import { FormField } from "@/ui/components/form/formfield/FormField";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IInputProps
  extends IBaseFormFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /**
   * Restrict default value to string | number as we don't use this component for checkbox
   */
  defaultValue?: string | number;
  fieldClassName?: string;
  ref?: Ref<HTMLInputElement>;
  size?: "sm" | "md";
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
  hideErrors,
  hideLabel,
  hints = [],
  hintsTypographyType,
  id,
  label = "",
  maxLength,
  onChange = () => null,
  readOnly,
  required,
  showRequiredLabel,
  size = "md",
  type = "text",
  value,
  ...props
}: IInputProps) => {
  const trimToMaxLength = (val?: IInputProps["value"]) =>
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
      hideErrors={hideErrors}
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
          errorMessage ? `${id}_error` : hints.length > 0 ? `${id}_hints` : undefined
        }
        aria-invalid={!!errorMessage || undefined}
        className={joinClasses(["nxm-input", className], {
          "nxm-input-sm": size === "sm",
          "nxm-input-error": typeof errorMessage === "string",
          "nxm-input-disabled": readOnly || disabled,
        })}
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
