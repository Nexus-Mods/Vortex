import {
  Combobox as HeadlessCombobox,
  ComboboxInput as HeadlessComboboxInput,
  ComboboxOption as HeadlessComboboxOption,
  ComboboxOptions as HeadlessComboboxOptions,
} from "@headlessui/react";
import React, { type InputHTMLAttributes, Fragment, type ReactNode, useId } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

interface IComboboxProps<T> {
  children: ReactNode;
  className?: string;
  /** Open the options as soon as the input is focused, before anything is typed. */
  immediate?: boolean;
  value: T | null;
  onChange: (value: T | null) => void;
  onClose?: () => void;
}

export const Combobox = <T,>({ className, ...props }: IComboboxProps<T>) => (
  <HeadlessCombobox as="div" className={joinClasses(["nxm-dropdown", className])} {...props} />
);

type IComboboxInputProps<T> = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "defaultValue"
> & {
  displayValue?: (item: T | null) => string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export const ComboboxInput = <T,>({ className, ...props }: IComboboxInputProps<T>) => (
  <HeadlessComboboxInput
    className={joinClasses([
      "typography-body-md w-full rounded-sm border border-stroke-subdued bg-surface-low",
      "px-4 py-2 text-neutral-strong",
      "hover:border-stroke-strong focus:border-stroke-strong focus-visible:outline-offset-1",
      className,
    ])}
    {...props}
  />
);

export const ComboboxOptions = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <HeadlessComboboxOptions
    anchor={{ gap: 4, to: "bottom start" }}
    as="div"
    className={joinClasses(["nxm-dropdown-items", className])}
  >
    {children}
  </HeadlessComboboxOptions>
);

/** A labelled section inside the options list. Headings are inert, so arrow keys skip them. */
export const ComboboxGroup = ({ label, children }: { label: string; children: ReactNode }) => {
  const id = useId();

  return (
    <div aria-labelledby={id} role="group">
      <div className="nxm-dropdown-title" id={id}>
        {label}
      </div>

      {children}
    </div>
  );
};

interface IComboboxOptionProps<T> {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  value: T;
}

export const ComboboxOption = <T,>({ children, className, ...props }: IComboboxOptionProps<T>) => (
  <HeadlessComboboxOption as={Fragment} {...props}>
    {({ focus }) => (
      <div
        className={joinClasses(["nxm-dropdown-item nxm-dropdown-item-hoverable", className], {
          "nxm-dropdown-item-focus": focus,
        })}
      >
        {children}
      </div>
    )}
  </HeadlessComboboxOption>
);
