import React from "react";

import { Listbox } from "../listbox/Listbox";
import { ListboxButton } from "../listbox/ListboxButton";
import { ListboxOption } from "../listbox/ListboxOption";
import { ListboxOptions } from "../listbox/ListboxOptions";

interface ITableFilterSelectProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}

/**
 * Select-style filter built on the shared {@link Listbox}. The placeholder is
 * modelled as an empty-value option, so picking it clears the filter. The
 * Listbox button matches the small text {@link Input} height out of the box.
 */
export const TableFilterSelect = ({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
}: ITableFilterSelectProps) => {
  const allOptions = [{ label: placeholder, value: "" }, ...options];
  const selected = allOptions.find((option) => option.value === value);

  return (
    <Listbox className="w-full" value={value} onChange={onChange}>
      <ListboxButton aria-label={label} className="w-full justify-between" id={id}>
        {selected?.label ?? placeholder}
      </ListboxButton>

      <ListboxOptions className="right-auto left-0 w-full">
        {allOptions.map((option) => (
          <ListboxOption key={option.value} label={option.label} value={option.value} />
        ))}
      </ListboxOptions>
    </Listbox>
  );
};
