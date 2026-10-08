import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ITableCheckboxProps } from "./TableCheckbox";

/** A row as it's shown: its key among the table's rows, and the id it's selected by. */
export interface ITableSelectionRow {
  key: string;
  id: string;
}

/** The keys held while a row is clicked, as Explorer reads them. */
export interface ITableRowClick {
  /** Ctrl, or Cmd on macOS: adds the row to the selection or takes it out. */
  toggle: boolean;
  /** Shift: selects the rows from the last one clicked to this one. */
  range: boolean;
}

/**
 * The rows the user has selected, by id, and the ways to change them: checkboxes, which
 * add and remove a row each, and clicks on the rows, which follow Explorer.
 *
 * `rows` is every row as it's shown, in order, so a range runs down the screen: a row in
 * two groups is there twice, and a range runs from the place it was clicked in.
 */
export const useTableSelection = (rowIds: string[], rows: ITableSelectionRow[]) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // the key of the row a range runs from: the last one clicked, or ticked, on its own
  const anchorRef = useRef<string>(undefined);

  const count = useMemo(() => rowIds.filter((id) => selected.has(id)).length, [rowIds, selected]);

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const header: ITableCheckboxProps = {
    label: t("Select all"),
    checked: rowIds.length > 0 && count === rowIds.length,
    indeterminate: count > 0 && count < rowIds.length,
    onChange: (checked) => setSelected(new Set(checked ? rowIds : [])),
  };

  const checkbox = useCallback(
    (row: ITableSelectionRow, name?: string): ITableCheckboxProps => ({
      label: name === undefined ? t("Select row") : t("Select {{name}}", { name }),
      checked: selected.has(row.id),
      onChange: (checked) => {
        anchorRef.current = row.key;
        toggleRow(row.id, checked);
      },
    }),
    [selected, t, toggleRow],
  );

  const click = useCallback(
    (row: ITableSelectionRow, { toggle, range }: ITableRowClick) => {
      const from = rows.findIndex(({ key }) => key === anchorRef.current);

      // A range keeps its anchor, so the next one runs from the same row.
      if (range && from !== -1) {
        const to = rows.findIndex(({ key }) => key === row.key);
        const span = rows.slice(Math.min(from, to), Math.max(from, to) + 1).map(({ id }) => id);

        setSelected((previous) => new Set(toggle ? [...previous, ...span] : span));
        return;
      }

      anchorRef.current = row.key;

      if (toggle) {
        setSelected((previous) => {
          const next = new Set(previous);
          if (!next.delete(row.id)) {
            next.add(row.id);
          }
          return next;
        });
        return;
      }

      setSelected(new Set([row.id]));
    },
    [rows],
  );

  const clear = useCallback(() => {
    anchorRef.current = undefined;
    setSelected(new Set());
  }, []);

  return { header, checkbox, click, clear };
};
