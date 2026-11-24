import { Input as HeadlessInput } from "@headlessui/react";
import React, { forwardRef } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { joinClasses } from "@/ui/utils/joinClasses";

// No `id`: Headless UI generates the ids that link the label, and a custom one breaks click-to-focus.
export interface ISliderFieldProps {
  /** Names the slider. Always needed: `hideLabel` hides it on screen, not from screen readers. */
  label: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /**
   * The value in words, shown beside the slider and read out in place of the number. Give it
   * whenever the number is not what the user is choosing, such as the position of a stop.
   */
  valueText?: string;
  /** Help text under the slider, one line per hint. */
  hints?: string | string[];
  disabled?: boolean;
  /** Classes for the field around the slider; `className` goes on the slider itself. */
  fieldClassName?: string;
  className?: string;
  "data-testid"?: string;
}

/** A slider with its label, its value in words and its hints. */
export const SliderField = forwardRef<HTMLInputElement, ISliderFieldProps>(
  (
    {
      className,
      disabled,
      fieldClassName,
      hideLabel = false,
      hints = [],
      label,
      max,
      min,
      onChange,
      step = 1,
      value,
      valueText,
      ...props
    },
    ref,
  ) => {
    const hintList = Array.isArray(hints) ? hints : [hints];

    return (
      <Field className={fieldClassName} disabled={disabled}>
        <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>

        <div className="flex items-center gap-x-3">
          <HeadlessInput
            aria-valuetext={valueText}
            className={joinClasses(["nxm-slider", className])}
            max={max}
            min={min}
            ref={ref}
            step={step}
            type="range"
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            {...props}
          />

          {valueText !== undefined && (
            <span aria-hidden="true" className="nxm-slider-value nxm-field-description">
              {valueText}
            </span>
          )}
        </div>

        {!!hintList.length && (
          <div className="nxm-field-footer">
            <div className="nxm-field-messages">
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
