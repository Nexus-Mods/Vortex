import React, { type CSSProperties, Fragment, useCallback, useMemo, useState } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { ITableGroup, ITableProps, TableItem } from "./Table.types";
import { TableGroupBackdrop } from "./TableGroupBackdrop";
import { TableGroupRow } from "./TableGroupRow";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { TableSpacer } from "./TableSpacer";
import { useTableGroupBackdrops } from "./useTableGroupBackdrops.hook";
import { useTableSort } from "./useTableSort.hook";
import { useTableVirtualizer } from "./useTableVirtualizer.hook";

// Fixed, so the virtualiser knows every row's height without measuring; table.css reads them.
const ROW_HEIGHT = 40;
const GROUP_ROW_HEIGHT = 48;
const GROUP_ROW_GAP = 4;

/**
 * A column-driven table drawn as one CSS grid: the columns' widths make its tracks, and
 * every row is a subgrid of them, so cells line up across rows without a `<table>`.
 * Carries the grid roles, so it reads as a table to assistive tech; grouped, it's a
 * treegrid whose group rows collapse. Only the rows in view render, against the page's
 * scroller, under a header that sticks to it.
 */
export const Table = <T, G extends ITableGroup<T> = ITableGroup<T>>({
  columns,
  rows,
  groups,
  getRowId,
  label,
  toolbar,
  defaultSort,
  className,
}: ITableProps<T, G>) => {
  const { sort, sortRows, toggleSort } = useTableSort(columns, defaultSort);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (groupId: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(groupId)) {
        next.add(groupId);
      }
      return next;
    });

  // Every row in order, a group's under it while it's open, as the virtualiser counts them.
  const items = useMemo<Array<TableItem<T, G>>>(() => {
    if (groups === undefined) {
      return sortRows(rows).map((row) => ({ kind: "row", key: getRowId(row), row }));
    }

    return groups.flatMap((group): Array<TableItem<T, G>> => {
      const expanded = !collapsed.has(group.id);

      const groupItem: TableItem<T, G> = {
        kind: "group",
        key: `group:${group.id}`,
        group,
        expanded,
      };

      if (!expanded) {
        return [groupItem];
      }

      return [
        groupItem,
        ...sortRows(group.rows).map(
          (row): TableItem<T, G> => ({
            kind: "row",
            key: `${group.id}:${getRowId(row)}`,
            row,
            level: 2,
          }),
        ),
      ];
    });
  }, [collapsed, getRowId, groups, rows, sortRows]);

  const getItemKey = useCallback((index: number) => items[index].key, [items]);
  const getItemSize = useCallback(
    (index: number) =>
      items[index].kind === "group" ? GROUP_ROW_HEIGHT + GROUP_ROW_GAP : ROW_HEIGHT,
    [items],
  );

  const virtual = useTableVirtualizer({ count: items.length, getItemKey, getItemSize });
  // The rows in the sticky head, which come before the table's own in aria-rowindex.
  const headRows = toolbar ? 2 : 1;

  const backdrops = useTableGroupBackdrops({ getItemSize, items, rendered: virtual.items });

  return (
    <div
      aria-label={label}
      aria-rowcount={items.length + headRows}
      className={joinClasses(["nxm-table", className])}
      data-toolbar={toolbar ? "" : undefined}
      ref={virtual.tableRef}
      role={groups === undefined ? "grid" : "treegrid"}
      style={
        {
          "--nxm-table-row-height": `${ROW_HEIGHT}px`,
          "--nxm-table-group-row-height": `${GROUP_ROW_HEIGHT}px`,
          "--nxm-table-group-row-gap": `${GROUP_ROW_GAP}px`,
          gridTemplateColumns: [
            "var(--nxm-table-gutter)",
            ...columns.map((column) => column.width ?? "minmax(0, 1fr)"),
            "var(--nxm-table-gutter)",
          ].join(" "),
        } as CSSProperties
      }
      onBlur={virtual.onBlur}
      onFocus={virtual.onFocus}
    >
      <TableHeader columns={columns} sort={sort} toolbar={toolbar} onSort={toggleSort} />

      {/* Always rendered, at the top of the rows: where the virtualiser measures from. */}
      <div className="nxm-table-spacer" ref={virtual.startRef} role="presentation" />

      {/* Behind the groups in view, even one whose own row has scrolled away. */}
      {backdrops.map(({ height, key, src, top }) => (
        <TableGroupBackdrop height={height} key={`backdrop:${key}`} src={src} top={top} />
      ))}

      {virtual.items.map(({ gap, index }) => {
        const item = items[index];

        return (
          <Fragment key={item.key}>
            {/* Rows out of view, before a focused row kept far from the rest too. */}
            <TableSpacer height={gap} />

            {item.kind === "group" ? (
              <TableGroupRow
                columns={columns}
                expanded={item.expanded}
                group={item.group}
                index={index}
                rowIndex={index + headRows + 1}
                onToggle={() => toggle(item.group.id)}
              />
            ) : (
              <TableRow
                columns={columns}
                index={index}
                level={item.level}
                row={item.row}
                rowIndex={index + headRows + 1}
              />
            )}
          </Fragment>
        );
      })}

      <TableSpacer height={virtual.endGap} />
    </div>
  );
};
