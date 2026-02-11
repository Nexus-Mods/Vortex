import * as React from "react";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../listbox";

export interface PickerOption<T> {
  label: string;
  value: T;
}

interface PickerProps<T> {
  className?: string;
  options: PickerOption<T>[];
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
        {options.map((option) => (
          <ListboxOption key={option.label} value={option.value}>
            {option.label}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
