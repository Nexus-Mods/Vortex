import React from "react";

import { Checkbox } from "@/ui/components/form/checkbox/Checkbox";

export interface ITableCheckboxProps {
  /** Names the checkbox. */
  label: string;
  /** Whether it's ticked. */
  checked: boolean;
  /** Some but not all of the rows it stands for are selected. */
  indeterminate?: boolean;
  /** Selects or deselects what it stands for. */
  onChange: (checked: boolean) => void;
}

/** A row's checkbox, or the header's for every row, in the first column's leading box. */
export const TableCheckbox = ({ label, checked, indeterminate, onChange }: ITableCheckboxProps) => (
  <span className="nxm-table-checkbox">
    <Checkbox
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      onChange={onChange}
    />
  </span>
);
