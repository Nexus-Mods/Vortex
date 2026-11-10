import React from "react";

import { Listbox } from "@/ui/components/listbox/Listbox";
import { ListboxButton, type IListboxButtonProps } from "@/ui/components/listbox/ListboxButton";
import { ListboxOption, type IListboxOption } from "@/ui/components/listbox/ListboxOption";
import { ListboxOptions } from "@/ui/components/listbox/ListboxOptions";

interface IPickerProps<T> {
  /** Props for the button showing the chosen option, such as its size. */
  button?: IListboxButtonProps;
  /** Classes for the wrapper around the button and its list. */
  className?: string;
  /** Shows the value without letting it change. */
  disabled?: boolean;
  /** The choices, each a label and the value it stands for. */
  options: IListboxOption<T>[];
  /** Which edge of the button the list lines up with; "right" by default. */
  placement?: "left" | "right";
  /** The chosen option's value. */
  value: T;
  /** Chooses another option, by its value. */
  onChange: (value: T) => void;
}

export function Picker<T>({
  button,
  className,
  disabled,
  options,
  placement = "right",
  value,
  onChange,
}: IPickerProps<T>) {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <Listbox className={className} disabled={disabled} value={value} onChange={onChange}>
      <ListboxButton {...button}>{selectedOption?.label}</ListboxButton>

      <ListboxOptions anchor={{ gap: 4, to: placement === "left" ? "bottom start" : "bottom end" }}>
        {options.map(({ ...option }) => (
          <ListboxOption key={option.label} {...option} />
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
