import React from "react";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  type IListboxOption,
  ListboxOptions,
} from "../listbox";

// todo placement prop should be removed when you use headless ui v2

interface PickerProps<T> {
  className?: string;
  options: IListboxOption<T>[];
  placement?: "left" | "right";
  value: T;
  onChange: (value: T) => void;
}

export function Picker<T>({
  className,
  options,
  placement = "right",
  value,
  onChange,
}: PickerProps<T>) {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <Listbox className={className} value={value} onChange={onChange}>
      <ListboxButton>{selectedOption?.label}</ListboxButton>

      <ListboxOptions className={placement === "left" && "right-auto left-0"}>
        {options.map(({ ...option }) => (
          <ListboxOption key={option.label} {...option} />
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
