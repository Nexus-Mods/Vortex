import { Listbox as HeadlessListbox } from "@headlessui/react";
import { mdiArrowExpandHorizontal, mdiCog } from "@mdi/js";
import React from "react";

import { DropdownTitle } from "@/ui/components/dropdown/DropdownTitle";

import { Button } from "../button/Button";
import { Icon } from "../icon/Icon";
import { Listbox } from "../listbox/Listbox";
import { ListboxOption } from "../listbox/ListboxOption";
import { ListboxOptions } from "../listbox/ListboxOptions";
import type { IColumnDef } from "./Table.types";

interface ITableColumnToggleProps<T> {
  columns: Array<IColumnDef<T>>;
  hiddenColumnIds: Set<string>;
  onToggleColumn: (columnId: string, hidden: boolean) => void;
  onResetWidths?: () => void;
  canResetWidths?: boolean;
}

/**
 * Gear control that opens a multi-select {@link Listbox} for showing and
 * hiding columns. The selected options are the currently-visible columns, so
 * each row shows a tick when its column is on. Non-hideable columns are
 * omitted and the last visible column cannot be hidden, so the table never
 * collapses to nothing.
 */
export const TableColumnToggle = <T,>({
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onResetWidths,
  canResetWidths = false,
}: ITableColumnToggleProps<T>) => {
  const hideableColumns = columns.filter((column) => column.hideable !== false);
  const visibleIds = hideableColumns
    .filter((column) => !hiddenColumnIds.has(column.id))
    .map((column) => column.id);

  if (hideableColumns.length === 0) {
    return null;
  }

  // Listbox hands back the full next selection; translate the single changed
  // entry into a show/hide toggle and refuse to hide the final column.
  const handleChange = (nextIds: string[]) => {
    if (nextIds.length === 0) {
      return;
    }

    const added = nextIds.find((id) => !visibleIds.includes(id));
    if (added) {
      onToggleColumn(added, false);
      return;
    }

    const removed = visibleIds.find((id) => !nextIds.includes(id));
    if (removed) {
      onToggleColumn(removed, true);
    }
  };

  return (
    <Listbox
      className="nxm-table-column-toggle"
      multiple={true}
      value={visibleIds}
      onChange={handleChange}
    >
      <HeadlessListbox.Button
        appearance="weak"
        aria-label="Manage columns"
        as={Button}
        brand="neutral"
        leftIconPath={mdiCog}
        size="sm"
        title="Manage columns"
      />

      <ListboxOptions className="right-0 left-auto">
        <DropdownTitle>Columns</DropdownTitle>

        {hideableColumns.map((column) => (
          <ListboxOption
            disabled={visibleIds.length === 1 && visibleIds.includes(column.id)}
            key={column.id}
            label={column.header}
            value={column.id}
          />
        ))}

        {onResetWidths && (
          <>
            <span className="nxm-dropdown-divider" />

            <button
              className="nxm-dropdown-item"
              disabled={!canResetWidths}
              type="button"
              onClick={(event) => {
                onResetWidths();
                // This is a multi-select Listbox, so it stays open on clicks and
                // v1 exposes no programmatic close. Mimic Escape (handled by
                // Listbox.Options) to dismiss the menu after resetting.
                event.currentTarget.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
                );
              }}
            >
              <Icon
                className="nxm-dropdown-item-icon"
                path={mdiArrowExpandHorizontal}
                size="none"
              />

              <span className="nxm-dropdown-item-label">Reset column widths</span>
            </button>
          </>
        )}
      </ListboxOptions>
    </Listbox>
  );
};
