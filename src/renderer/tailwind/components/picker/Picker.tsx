import React from "react";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  type IListboxOption,
  ListboxOptions,
} from "../listbox";

interface PickerProps<T> {
  className?: string;
  options: IListboxOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Picker<T>({
  className,
  options,
  value,
  onChange,
}: PickerProps<T>) {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <Listbox className={className} value={value} onChange={onChange}>
      <ListboxButton>{selectedOption?.label}</ListboxButton>

      <ListboxOptions>
        {options.map(({ ...option }) => (
          <ListboxOption key={option.label} {...option} />
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
