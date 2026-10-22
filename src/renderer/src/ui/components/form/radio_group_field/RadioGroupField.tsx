import { RadioGroup, type RadioGroupProps } from "@headlessui/react";
import React, { forwardRef } from "react";

import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Radio } from "@/ui/components/form/radio/Radio";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IRadioOption {
  /** What the group's value is while this option is chosen. */
  value: string;
  /** Names the option, beside its radio. */
  label: string;
  /** Help text under the option's label. */
  hint?: string;
  /** Stops the option being chosen. */
  disabled?: boolean;
  /** A `data-testid` for the option's radio, for tests to find it by. */
  testId?: string;
}

export type IRadioGroupFieldProps = Omit<
  RadioGroupProps<"div", string>,
  "children" | "className" | "defaultValue" | "onChange" | "value"
> & {
  /** Classes for the group. */
  className?: string;
  /** Names the group for screen readers. It isn't shown. */
  label: string;
  /** The options to choose from, in the order they're shown. */
  options: IRadioOption[];
  /** The selected option's value, or undefined while none is selected. */
  value: string | undefined;
  /** Receives the value of the option that was chosen. */
  onChange: (value: string) => void;
};

/**
 * A group of radio options, one chosen at a time, each with its label and optional hint. Clicking
 * a label chooses its option, and the arrow keys move between them.
 */
export const RadioGroupField = forwardRef<HTMLDivElement, IRadioGroupFieldProps>(
  ({ className, label, options, value, onChange, ...props }, ref) => (
    <RadioGroup
      {...props}
      aria-label={label}
      className={joinClasses(["nxm-radio-group", className])}
      ref={ref}
      value={value ?? null}
      onChange={onChange}
    >
      {options.map((option) => (
        <Field className="nxm-radio-field" disabled={option.disabled} key={option.value}>
          <div className="nxm-field-control">
            <Radio data-testid={option.testId} value={option.value} />

            <Label>{option.label}</Label>
          </div>

          {!!option.hint && <Description>{option.hint}</Description>}
        </Field>
      ))}
    </RadioGroup>
  ),
);
