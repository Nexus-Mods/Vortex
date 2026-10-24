import {
  Combobox as HeadlessCombobox,
  ComboboxInput as HeadlessComboboxInput,
  ComboboxOption as HeadlessComboboxOption,
  ComboboxOptions as HeadlessComboboxOptions,
  type ComboboxInputProps,
  type ComboboxOptionsProps,
  type ComboboxProps,
} from "@headlessui/react";
import React, { Fragment, forwardRef, type ReactNode, type Ref, useId } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/*
 * Lives in this module for now, but is deliberately shaped like a design-system form component
 * (`form/select` + `form/select_field`) so it can move to `ui/components/form/combobox` as-is.
 */

export type IComboboxProps<T> = Omit<ComboboxProps<T, false, "div">, "className"> & {
  className?: string;
};

/**
 * A searchable select. Inside a `Field` it's named by the field's `Label`; on its own it needs an
 * `aria-label`. For the usual label, hints and error in one, use `ComboboxField`.
 *
 * Filtering is the caller's job: pass whatever options should be shown as children and keep the
 * query in your own state. This only owns keyboard navigation and selection.
 *
 * The root carries `nxm-field-control` so it sits as a direct sibling of the `Label`, which is
 * what `field.css` keys its spacing off.
 */
export const Combobox = <T,>({ className, ...props }: IComboboxProps<T>) => (
  <HeadlessCombobox
    as="div"
    className={joinClasses(["nxm-dropdown nxm-field-control", className])}
    {...props}
  />
);

export type IComboboxInputProps<T> = Omit<ComboboxInputProps<"input", T>, "className"> & {
  className?: string;
};

const ComboboxInputInner = <T,>(
  { className, ...props }: IComboboxInputProps<T>,
  ref: Ref<HTMLInputElement>,
) => (
  <HeadlessComboboxInput className={joinClasses(["nxm-input", className])} ref={ref} {...props} />
);

/** The text input half of the combobox. Styled as `Input` so it matches the other form controls. */
export const ComboboxInput = forwardRef(ComboboxInputInner) as <T>(
  props: IComboboxInputProps<T> & { ref?: Ref<HTMLInputElement> },
) => ReturnType<typeof ComboboxInputInner>;

export type IComboboxOptionsProps = Omit<ComboboxOptionsProps<"div">, "className"> & {
  className?: string;
};

/** The floating options panel. Anchored to the control by Headless UI. */
export const ComboboxOptions = ({ className, ...props }: IComboboxOptionsProps) => (
  <HeadlessComboboxOptions
    anchor={{ gap: 4, to: "bottom start" }}
    as="div"
    className={joinClasses(["nxm-dropdown-items", className])}
    {...props}
  />
);

export interface IComboboxGroupProps {
  children: ReactNode;
  label: string;
}

/**
 * A labelled section inside the options panel. Headless UI's `Label` names the control, not
 * sections within it, so the heading is wired up by hand here. Headings are inert, so arrow keys
 * skip over them.
 */
export const ComboboxGroup = ({ children, label }: IComboboxGroupProps) => {
  const id = useId();

  return (
    <div aria-labelledby={id} role="group">
      <div className="nxm-dropdown-title py-1" id={id}>
        {label}
      </div>

      {children}
    </div>
  );
};

export interface IComboboxOptionProps<T> {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  value: T;
}

/**
 * One selectable row. Rendered through Headless UI's render prop so the focused row can take
 * `nxm-dropdown-item-focus`, which is how `dropdown.css` styles it.
 *
 * `h-7` matches `nxm-input`'s min-height: `.nxm-dropdown-item` is 8 spacing units tall, which is
 * a touch taller than this form's controls.
 */
export const ComboboxOption = <T,>({ children, className, ...props }: IComboboxOptionProps<T>) => (
  <HeadlessComboboxOption as={Fragment} {...props}>
    {({ focus }) => (
      <div
        className={joinClasses(["nxm-dropdown-item nxm-dropdown-item-hoverable h-7", className], {
          "nxm-dropdown-item-focus": focus,
        })}
      >
        {children}
      </div>
    )}
  </HeadlessComboboxOption>
);
