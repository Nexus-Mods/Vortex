/**
 * FormField Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a form field wrapper with label, hints, error messages, and character counter.
 */

import React, { type HTMLAttributes, type ReactNode, type Ref } from "react";

import { Typography, type TypographyTypes } from "../../typography";
import { joinClasses } from "../../utils";

export interface BaseFormFieldProps {
  /**
   * Makes the elements non-interactive
   */
  disabled?: boolean;

  /**
   * Styles and adds an error message to the field
   */
  errorMessage?: string;

  /**
   * Hides the error messages
   */
  hideErrors?: boolean;

  /**
   * Hides the label
   */
  hideLabel?: boolean;

  /**
   * Applies additional hint to the field
   */
  hints?: string | string[];

  /**
   * Typography type for hints
   */
  hintsTypographyType?: TypographyTypes;

  /**
   * Applies additional hint to the field
   */
  id?: string;

  /**
   * Adds a label that floats if no placeholder is provided
   */
  label?: string;

  /**
   * Adds a required text inside the label
   */
  showRequiredLabel?: boolean;
}

export interface FormFieldProps
  extends BaseFormFieldProps,
    HTMLAttributes<HTMLElement> {
  /**
   * Form element to be rendered
   */
  children?: ReactNode;

  /**
   * Current length of the input value
   */
  inputLength?: number;

  /**
   * Max length input value can be
   */
  maxLength?: number;

  ref?: Ref<HTMLDivElement>;
}

export const FormField = ({
  children,
  className,
  disabled,
  errorMessage,
  hideLabel,
  hideErrors,
  hints = [],
  hintsTypographyType = "body-md",
  id,
  inputLength = 0,
  label = "",
  maxLength,
  ref,
  showRequiredLabel,
}: FormFieldProps) => {
  // Make sure hints is always an array
  hints = !Array.isArray(hints) ? [hints] : hints;

  return (
    <div
      className={joinClasses(["min-w-0", className], {
        "pointer-events-none opacity-40": disabled,
      })}
      ref={ref}
    >
      <label
        className={joinClasses(["mb-2 flex gap-x-1 text-sm"], {
          "sr-only": hideLabel,
        })}
        htmlFor={id}
      >
        <Typography as="span" typographyType="body-md">
          {label}

          {showRequiredLabel && (
            <Typography appearance="subdued" as="span" typographyType="body-md">
              {` (Required)`}
            </Typography>
          )}
        </Typography>
      </label>

      {children}

      {((!!errorMessage && !hideErrors) || !!hints.length || !!maxLength) && (
        <div className="flex justify-between pt-1">
          <div>
            {!!errorMessage && (
              <Typography
                appearance="none"
                className="text-danger-strong"
                id={`${id}_error`}
              >
                {errorMessage}
              </Typography>
            )}

            {!!hints.length && (
              <ul className="flex flex-col gap-y-1" id={`${id}_hints`}>
                {hints.map((hint) => (
                  <li key={`${id}_${hint}`}>
                    <Typography
                      appearance="subdued"
                      as="span"
                      typographyType={hintsTypographyType}
                    >
                      {hint}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!!maxLength && (
            <Typography
              appearance="none"
              aria-label="remaining character count"
              className={joinClasses([
                "font-semibold",
                maxLength - inputLength <= maxLength * 0.1
                  ? "text-danger-strong"
                  : maxLength - inputLength <= maxLength * 0.25
                    ? "text-warning-strong"
                    : "text-neutral-moderate",
              ])}
            >
              {`${maxLength - inputLength} / ${maxLength}`}
            </Typography>
          )}
        </div>
      )}
    </div>
  );
};

export const FormFieldWrap = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-y-4">{children}</div>
);
