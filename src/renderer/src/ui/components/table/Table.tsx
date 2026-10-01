import React, { Fragment, useState } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { ITableGroup, ITableProps } from "./Table.types";
import { TableGroupRow } from "./TableGroupRow";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";

/**
 * A column-driven table drawn as one CSS grid: the columns' widths make its tracks, and
 * every row is a subgrid of them, so cells line up across rows without a `<table>`.
 * Carries the grid roles, so it reads as a table to assistive tech; grouped, it's a
 * treegrid whose group rows collapse.
 */
export const Table = <T, G extends ITableGroup<T> = ITableGroup<T>>({
  columns,
  rows,
  groups,
  getRowId,
  label,
  className,
}: ITableProps<T, G>) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (groupId: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(groupId)) {
        next.add(groupId);
      }
      return next;
    });

  const rowCount =
    1 +
    (groups === undefined
      ? rows.length
      : groups.reduce(
          (count, group) => count + 1 + (collapsed.has(group.id) ? 0 : group.rows.length),
          0,
        ));

  return (
    <div
      aria-label={label}
      aria-rowcount={rowCount}
      className={joinClasses(["nxm-table", className])}
      role={groups === undefined ? "grid" : "treegrid"}
      style={{
        gridTemplateColumns: [
          "var(--nxm-table-gutter)",
          ...columns.map((column) => column.width ?? "minmax(0, 1fr)"),
          "var(--nxm-table-gutter)",
        ].join(" "),
      }}
    >
      <TableHeader columns={columns} />

      {groups === undefined
        ? rows.map((row) => <TableRow columns={columns} key={getRowId(row)} row={row} />)
        : groups.map((group) => {
            const expanded = !collapsed.has(group.id);

            return (
              <Fragment key={group.id}>
                <TableGroupRow
                  columns={columns}
                  expanded={expanded}
                  group={group}
                  onToggle={() => toggle(group.id)}
                />

                {expanded &&
                  group.rows.map((row) => (
                    <TableRow
                      columns={columns}
                      key={`${group.id}:${getRowId(row)}`}
                      level={2}
                      row={row}
                    />
                  ))}
              </Fragment>
            );
          })}
    </div>
  );
};
