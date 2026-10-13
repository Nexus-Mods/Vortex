import { Textarea, type TextareaProps } from "@headlessui/react";
import React, { forwardRef } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { ErrorMessage } from "@/ui/components/form/field/ErrorMessage";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { joinClasses } from "@/ui/utils/joinClasses";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-focus.
export type ITextAreaFieldProps = Omit<TextareaProps, "className" | "id"> & {
  className?: string;
  /** Names the text area. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  /** Marks the text area invalid and says why. */
  errorMessage?: string;
  /** Help text under the text area, one line per hint. */
  hints?: string | string[];
  /** Classes for the field around the text area; `className` goes on the text area itself. */
  fieldClassName?: string;
};

/** A multi-line text input with its label, hints and error. For one line, use `TextField`. */
export const TextAreaField = forwardRef<HTMLTextAreaElement, ITextAreaFieldProps>(
  (
    {
      className,
      disabled,
      errorMessage,
      fieldClassName,
      hideLabel = false,
      hints = [],
      label,
      ...props
    },
    ref,
  ) => {
    const hintList = Array.isArray(hints) ? hints : [hints];

    return (
      <Field className={fieldClassName} disabled={disabled}>
        <Label className={hideLabel ? "sr-only" : undefined} required={props.required}>
          {label}
        </Label>

        <div className="nxm-field-control">
          <Textarea
            {...props}
            className={joinClasses(["nxm-input", "nxm-textarea", className])}
            invalid={!!errorMessage}
            ref={ref}
          />
        </div>

        {(!!errorMessage || !!hintList.length) && (
          <div className="nxm-field-footer">
            <div className="nxm-field-messages">
              {!!errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}

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
