import { Radio, RadioGroup } from "@headlessui/react";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export interface IToggleButtonOption<T extends string> {
  /** What the group's value is while this option is chosen. */
  value: T;
  /** The option's button text. */
  label: string;
  /** Stops the option being chosen. */
  disabled?: boolean;
  /** A `data-testid` for the option's button, for tests to find it by. */
  testId?: string;
}

export interface IToggleButtonGroupProps<T extends string> {
  /** Classes for the group. */
  className?: string;
  /** Names the group for screen readers. It isn't shown. */
  label: string;
  /** The options, left to right. */
  options: IToggleButtonOption<T>[];
  /** The chosen option's value, or undefined while none is chosen. */
  value: T | undefined;
  /** Receives the value of the option that was chosen. */
  onChange: (value: T) => void;
  /** Stops every option being chosen. */
  disabled?: boolean;
  /** A `data-testid` for the group. */
  "data-testid"?: string;
}

/**
 * A row of buttons sharing one outline, one chosen at a time: a radio group drawn as buttons, the
 * chosen one filled. It's as tall as a small button, so lines up with one. Each option keeps its place in the row and the buttons share a width, so a column of
 * groups reads at a glance. The arrow keys move between options, as in any radio group.
 */
export const ToggleButtonGroup = <T extends string>({
  className,
  label,
  options,
  value,
  onChange,
  disabled = false,
  "data-testid": testId,
}: IToggleButtonGroupProps<T>) => (
  <RadioGroup
    aria-label={label}
    // The outline is the group's own, drawn under its buttons in their box, as a subdued button's
    // is in its own: so the group is a button's height, and a disabled option doesn't fade it.
    className={joinClasses([
      "relative isolate inline-grid shrink-0 auto-cols-fr grid-flow-col before:pointer-events-none before:absolute before:inset-0 before:rounded-sm before:border before:border-stroke-weak",
      className,
    ])}
    data-testid={testId}
    disabled={disabled}
    value={value ?? null}
    onChange={onChange}
  >
    {options.map((option) => (
      <Radio
        as="button"
        className={({ checked, disabled: optionDisabled }) =>
          joinClasses(
            [
              "nxm-button nxm-button-sm nxm-button-neutral rounded-none first:rounded-l-sm last:rounded-r-sm",
              checked ? "nxm-button-moderate" : "nxm-button-weak",
            ],
            { "nxm-button-disabled": optionDisabled },
          )
        }
        data-testid={option.testId}
        disabled={option.disabled}
        key={option.value}
        type="button"
        value={option.value}
      >
        {option.label}
      </Radio>
    ))}
  </RadioGroup>
);
