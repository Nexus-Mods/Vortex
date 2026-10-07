import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ITableCheckboxProps } from "./TableCheckbox";

/** The rows the user has selected, by id, and the checkboxes that select them. */
export const useTableSelection = (rowIds: string[]) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const count = useMemo(() => rowIds.filter((id) => selected.has(id)).length, [rowIds, selected]);

  const header: ITableCheckboxProps = {
    label: t("Select all"),
    checked: rowIds.length > 0 && count === rowIds.length,
    indeterminate: count > 0 && count < rowIds.length,
    onChange: (checked) => setSelected(new Set(checked ? rowIds : [])),
  };

  const row = useCallback(
    (id: string, name?: string): ITableCheckboxProps => ({
      label: name === undefined ? t("Select row") : t("Select {{name}}", { name }),
      checked: selected.has(id),
      onChange: (checked) =>
        setSelected((previous) => {
          const next = new Set(previous);
          if (checked) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        }),
    }),
    [selected, t],
  );

  return { header, row };
};
