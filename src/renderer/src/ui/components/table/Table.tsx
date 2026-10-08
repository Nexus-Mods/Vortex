import React, { type CSSProperties, Fragment, useCallback, useMemo, useState } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { ITableGroup, ITableProps, TableItem } from "./Table.types";
import { TableGroupBackdrop } from "./TableGroupBackdrop";
import { TableGroupRow } from "./TableGroupRow";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { TableSpacer } from "./TableSpacer";
import { useTableGroupBackdrops } from "./useTableGroupBackdrops.hook";
import { useTableSelection } from "./useTableSelection.hook";
import { useTableSort } from "./useTableSort.hook";
import { useTableVirtualizer } from "./useTableVirtualizer.hook";

// Fixed, so the virtualiser knows every row's height without measuring; table.css reads them.
const ROW_HEIGHT = 40;
const GROUP_ROW_HEIGHT = 48;
const GROUP_ROW_GAP = 4;

/** A column without a width shares what's left, but never shrinks past this when columns overflow. */
const DEFAULT_COLUMN_WIDTH = "minmax(280px, 1fr)";

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
  footer,
  defaultSort,
  className,
  selectable = false,
  getRowLabel,
  selectedIds,
  onSelectedIdsChange,
}: ITableProps<T, G>) => {
  const { sort, sortRows, toggleSort } = useTableSort(columns, defaultSort);

  // Each row once, though a row in two groups shows in both.
  const rowIds = useMemo(
    () => [...new Set((rows ?? groups?.flatMap((group) => group.rows) ?? []).map(getRowId))],
    [getRowId, groups, rows],
  );
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
            tint: group.image,
          }),
        ),
      ];
    });
  }, [collapsed, getRowId, groups, rows, sortRows]);

  const shownRows = useMemo(
    () =>
      items.flatMap((item) =>
        item.kind === "row" ? [{ key: item.key, id: getRowId(item.row) }] : [],
      ),
    [getRowId, items],
  );
  const selection = useTableSelection(rowIds, shownRows, selectedIds, onSelectedIdsChange);

  const getItemKey = useCallback((index: number) => items[index].key, [items]);
  const getItemSize = useCallback(
    (index: number) =>
      items[index].kind === "group" ? GROUP_ROW_HEIGHT + GROUP_ROW_GAP : ROW_HEIGHT,
    [items],
  );

  const virtual = useTableVirtualizer({ count: items.length, getItemKey, getItemSize });
  const revealWidth = columns.find((column) => column.sticky === "end")?.revealWidth;
  // The rows in the sticky head, which come before the table's own in aria-rowindex.
  const headRows = toolbar ? 2 : 1;

  const backdrops = useTableGroupBackdrops({ getItemSize, items, rendered: virtual.items });

  return (
    <div
      aria-label={label}
      aria-rowcount={items.length + headRows + (footer ? 1 : 0)}
      className={joinClasses(["nxm-table", className])}
      data-sticky-reveal={revealWidth ? "" : undefined}
      data-toolbar={toolbar ? "" : undefined}
      ref={virtual.tableRef}
      role={groups === undefined ? "grid" : "treegrid"}
      style={
        {
          "--nxm-table-row-height": `${ROW_HEIGHT}px`,
          "--nxm-table-group-row-height": `${GROUP_ROW_HEIGHT}px`,
          "--nxm-table-group-row-gap": `${GROUP_ROW_GAP}px`,
          "--nxm-table-sticky-reveal": revealWidth,
          gridTemplateColumns: [
            "var(--nxm-table-gutter-start)",
            ...columns.map((column) => column.width ?? DEFAULT_COLUMN_WIDTH),
            "var(--nxm-table-gutter)",
          ].join(" "),
        } as CSSProperties
      }
      onBlur={virtual.onBlur}
      onClick={(event) => {
        // Between and below the rows, but not the head; a portalled panel isn't in the table.
        const target = event.target as Element;
        if (
          selectable &&
          event.currentTarget.contains(target) &&
          target.closest('[role="row"], [role="rowgroup"]') === null
        ) {
          selection.clear();
        }
      }}
      onFocus={virtual.onFocus}
    >
      <TableHeader
        columns={columns}
        checkbox={selectable ? selection.header : undefined}
        sort={sort}
        toolbar={toolbar}
        onSort={toggleSort}
      />

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
                sortedColumnId={sort?.columnId}
                checkbox={
                  selectable
                    ? selection.checkbox(
                        { key: item.key, id: getRowId(item.row) },
                        getRowLabel?.(item.row),
                      )
                    : undefined
                }
                tint={item.tint}
                onClick={
                  selectable
                    ? (click) => selection.click({ key: item.key, id: getRowId(item.row) }, click)
                    : undefined
                }
              />
            )}
          </Fragment>
        );
      })}

      <TableSpacer height={virtual.endGap} />

      {!!footer && (
        <div aria-rowindex={items.length + headRows + 1} className="nxm-table-footer" role="row">
          <div aria-colspan={columns.length} className="nxm-table-footer-cell" role="gridcell">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};
