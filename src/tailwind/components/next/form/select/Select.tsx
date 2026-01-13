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
        className={joinClasses(["tw:relative tw:flex tw:flex-col", className], {
          "tw:opacity-40": disabled,
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
            "tw:bg-surface-low tw:typography-body-lg tw:text-neutral-strong tw:relative tw:w-full tw:appearance-none tw:rounded tw:border tw:py-2 tw:pl-4 tw:pr-12",
            !!errorMessage
              ? "tw:border-danger-strong tw:hover:border-stroke-neutral-translucent-subdued"
              : "tw:border-stroke-neutral-translucent-subdued",
            "tw:hover:border-stroke-neutral-translucent-strong",
            "tw:focus:bg-surface-low tw:focus:border-stroke-neutral-translucent-strong tw:focus-visible:outline-offset-1",
          ])}
          disabled={disabled}
          id={id}
          required={required}
        >
          {children}
        </select>

        <Icon
          className={joinClasses([
            "tw:text-neutral-subdued tw:pointer-events-none tw:absolute tw:right-4 tw:top-1/2 tw:-translate-y-1/2 tw:transform",
            "tw:hover:text-white tw:focus:text-white",
          ])}
          path={mdiMenuDown}
          size="lg"
        />
      </div>
    </FormField>
  );
};
