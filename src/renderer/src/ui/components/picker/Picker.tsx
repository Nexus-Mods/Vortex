import React from "react";

import { Listbox } from "@/ui/components/listbox/Listbox";
import { ListboxButton, type IListboxButtonProps } from "@/ui/components/listbox/ListboxButton";
import { ListboxOption, type IListboxOption } from "@/ui/components/listbox/ListboxOption";
import { ListboxOptions } from "@/ui/components/listbox/ListboxOptions";

interface IPickerProps<T> {
  button?: IListboxButtonProps;
  className?: string;
  options: IListboxOption<T>[];
  placement?: "left" | "right";
  value: T;
  onChange: (value: T) => void;
}

export function Picker<T>({
  button,
  className,
  options,
  placement = "right",
  value,
  onChange,
}: IPickerProps<T>) {
  const selectedOption = options.find((o) => o.value === value);

  return (
    <Listbox className={className} value={value} onChange={onChange}>
      <ListboxButton {...button}>{selectedOption?.label}</ListboxButton>

      <ListboxOptions anchor={{ gap: 4, to: placement === "left" ? "bottom start" : "bottom end" }}>
        {options.map(({ ...option }) => (
          <ListboxOption key={option.label} {...option} />
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
