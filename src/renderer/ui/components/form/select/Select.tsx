/**
 * Select Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a styled select dropdown with custom icon and validation support.
 */

import type { Ref, SelectHTMLAttributes } from "react";

import { mdiMenuDown } from "@mdi/js";
import * as React from "react";

import type { BaseFormFieldProps } from "../formfield";

import { joinClasses } from "../../../utils/join_classes";
import { Icon } from "../../icon";
import { FormField } from "../formfield";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  BaseFormFieldProps & {
    ref?: Ref<HTMLSelectElement>;
  };

export const Select = ({
  children,
  className,
  disabled,
  errorMessage,
  hideLabel = false,
  hints = [],
  id,
  label = "",
  ref,
  required,
  showRequiredLabel,
  ...props
}: SelectProps) => {
  // Make sure hints is always an array
  hints = !Array.isArray(hints) ? [hints] : hints;

  return (
    <FormField
      className={className}
      disabled={disabled}
      errorMessage={errorMessage}
      hideLabel={hideLabel}
      hints={hints}
      id={id}
      label={label}
      showRequiredLabel={showRequiredLabel ?? required}
    >
      <div
        className={joinClasses(["relative flex flex-col", className], {
          "opacity-40": disabled,
        })}
      >
        <select
          {...props}
          aria-describedby={
            errorMessage
              ? `${id}_error`
              : hints.length > 0
                ? `${id}_hints`
                : undefined
          }
          aria-invalid={!!errorMessage || undefined}
          className={joinClasses([
            "typography-body-lg relative w-full appearance-none rounded-sm border bg-surface-low py-2 pr-12 pl-4 text-neutral-strong",
            errorMessage
              ? "border-danger-strong hover:border-stroke-subdued"
              : "border-stroke-subdued",
            "hover:border-stroke-strong",
            "focus:border-stroke-strong focus:bg-surface-low focus-visible:outline-offset-1",
          ])}
          disabled={disabled}
          id={id}
          ref={ref}
          required={required}
        >
          {children}
        </select>

        <Icon
          className={joinClasses([
            "pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 transform text-neutral-subdued",
            "hover:text-white focus:text-white",
          ])}
          path={mdiMenuDown}
          size="lg"
        />
      </div>
    </FormField>
  );
};
