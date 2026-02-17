/**
 * Select Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a styled select dropdown with custom icon and validation support.
 */

import * as React from "react";
import { mdiMenuDown } from "@mdi/js";
import type { Ref, SelectHTMLAttributes } from "react";

import { Icon } from "../../icon";
import { joinClasses } from "../../utils";
import type { BaseFormFieldProps } from "../formfield";
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
          ref={ref}
          aria-describedby={
            !!errorMessage
              ? `${id}_error`
              : hints.length > 0
                ? `${id}_hints`
                : undefined
          }
          aria-invalid={!!errorMessage || undefined}
          className={joinClasses([
            "bg-surface-low typography-body-lg text-neutral-strong relative w-full appearance-none rounded border py-2 pl-4 pr-12",
            !!errorMessage
              ? "border-danger-strong hover:border-stroke-subdued"
              : "border-stroke-subdued",
            "hover:border-stroke-strong",
            "focus:bg-surface-low focus:border-stroke-strong focus-visible:outline-offset-1",
          ])}
          disabled={disabled}
          id={id}
          required={required}
        >
          {children}
        </select>

        <Icon
          className={joinClasses([
            "text-neutral-subdued pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transform",
            "hover:text-white focus:text-white",
          ])}
          path={mdiMenuDown}
          size="lg"
        />
      </div>
    </FormField>
  );
};
