import { mdiArrowDown, mdiArrowUp, mdiFormatListGroup, mdiUnfoldMoreHorizontal } from "@mdi/js";
import React, { useMemo } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { Input } from "../form/input/Input";
import { Icon } from "../icon/Icon";
import { Pagination } from "../pagination/Pagination";
import type { IColumnDef, IColumnFilter, ITableProps } from "./Table.types";
import { TableColumnToggle } from "./TableColumnToggle";
import { TableFilterSelect } from "./TableFilterSelect";
import { TableGroupRow } from "./TableGroupRow";
import { TableEmptyRow, TableRow } from "./TableRow";
import { useColumnResize } from "./useColumnResize.hook";
import { useTableState } from "./useTableState.hook";

/**
 * Reads a column's configured `width` as a pixel number so it can act as the
 * resize floor. Non-pixel widths (e.g. `"20%"`) and undefined return undefined,
 * falling back to the resize hook's default minimum.
 */
const parsePxWidth = (width: string | undefined): number | undefined => {
  if (!width) {
    return undefined;
  }
  const match = /^(\d+(?:\.\d+)?)px$/.exec(width.trim());
  return match ? Number(match[1]) : undefined;
};

const sortIconPath = (state: "asc" | "desc" | "none") => {
  if (state === "asc") {
    return mdiArrowUp;
  }
  if (state === "desc") {
    return mdiArrowDown;
  }

  return mdiUnfoldMoreHorizontal;
};

const ColumnFilterControl = <T,>({
  column,
  filter,
  value,
  onChange,
}: {
  column: IColumnDef<T>;
  filter: IColumnFilter<T>;
  value: string;
  onChange: (value: string) => void;
}) => {
  const label = `Filter by ${column.header}`;
  const id = `nxm-table-filter-${column.id}`;

  if (filter.type === "select") {
    return (
      <TableFilterSelect
        id={id}
        label={label}
        options={filter.options}
        placeholder={filter.placeholder ?? "Select..."}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      hideLabel={true}
      id={id}
      label={label}
      placeholder={filter.placeholder ?? "Filter..."}
      size="sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export const Table = <T,>({
  columns,
  data,
  getRowId,
  pageSize,
  caption,
  className,
  enableFilters,
  enableColumnToggle,
  enableColumnResize = true,
  columnWidths: initialColumnWidths,
  onColumnWidthsChange,
  emptyState,
}: ITableProps<T>) => {
  const {
    visibleColumns,
    hiddenColumnIds,
    pageData,
    groups,
    groupByColumnId,
    collapsedGroups,
    sort,
    filters,
    currentPage,
    totalRecords,
    toggleSort,
    setColumnFilter,
    setColumnHidden,
    toggleGroupBy,
    setGroupCollapsed,
    setPage,
  } = useTableState({ columns, data, pageSize });

  const { columnWidths, handleResizeStart, hasCustomWidths, resetColumnWidths } = useColumnResize({
    initialWidths: initialColumnWidths,
    onChange: onColumnWidthsChange,
  });

  const showFilters = enableFilters ?? columns.some((column) => !!column.filter);
  const showColumnToggle =
    enableColumnToggle ?? columns.some((column) => column.hideable !== false);

  const lastColumnId = visibleColumns[visibleColumns.length - 1]?.id;
  const colCount = visibleColumns.length;

  const captionId = useMemo(
    () => (caption ? `nxm-table-caption-${caption.replace(/\s+/g, "-").toLowerCase()}` : undefined),
    [caption],
  );

  const isEmpty = groups ? groups.length === 0 : pageData.length === 0;

  // Once columns have custom widths, every visible column is pinned to an
  // explicit pixel width (see useColumnResize). Sizing the table to their exact
  // sum lets it grow past the container — so widening one column scrolls
  // horizontally rather than stealing width from the others. A `width: auto`
  // table would instead be capped at the container and redistribute the deficit.
  const resizedWidths = visibleColumns.map((column) => columnWidths[column.id]);
  const tableWidth =
    hasCustomWidths && resizedWidths.every((width) => typeof width === "number")
      ? resizedWidths.reduce((sum, width) => sum + width, 0)
      : undefined;

  return (
    <div className={joinClasses(["nxm-table-wrapper", className])}>
      <div className="nxm-table-scroll">
        <table
          aria-describedby={captionId}
          className="nxm-table"
          style={tableWidth ? { width: tableWidth } : undefined}
        >
          {!!caption && (
            <caption className="sr-only" id={captionId}>
              {caption}
            </caption>
          )}

          <colgroup>
            {visibleColumns.map((column) => {
              const width = columnWidths[column.id] ?? column.width;
              return <col key={column.id} style={width ? { width } : undefined} />;
            })}
          </colgroup>

          <thead className="nxm-table-head">
            <tr>
              {visibleColumns.map((column) => {
                const sortState = sort?.columnId === column.id ? sort.direction : ("none" as const);
                const ariaSort =
                  sort?.columnId === column.id
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                return (
                  <th
                    aria-sort={column.sortable ? ariaSort : undefined}
                    className="nxm-table-th"
                    data-column-id={column.id}
                    key={column.id}
                    scope="col"
                  >
                    <div className="nxm-table-th-content">
                      {column.sortable ? (
                        <button
                          className="nxm-table-sort"
                          type="button"
                          onClick={() => toggleSort(column.id)}
                        >
                          {column.header}

                          <Icon
                            className={joinClasses("nxm-table-sort-icon", {
                              "nxm-table-sort-icon-active": sortState !== "none",
                            })}
                            path={sortIconPath(sortState)}
                            size="sm"
                          />
                        </button>
                      ) : (
                        column.header
                      )}

                      {column.groupable && (
                        <button
                          aria-label={`Group by ${column.header}`}
                          aria-pressed={groupByColumnId === column.id}
                          className={joinClasses("nxm-table-group", {
                            "nxm-table-group-active": groupByColumnId === column.id,
                          })}
                          title={`Group by ${column.header}`}
                          type="button"
                          onClick={() => toggleGroupBy(column.id)}
                        >
                          <Icon path={mdiFormatListGroup} size="sm" />
                        </button>
                      )}

                      {showColumnToggle && column.id === lastColumnId && (
                        <TableColumnToggle
                          canResetWidths={hasCustomWidths}
                          columns={columns}
                          hiddenColumnIds={hiddenColumnIds}
                          onResetWidths={enableColumnResize ? resetColumnWidths : undefined}
                          onToggleColumn={setColumnHidden}
                        />
                      )}
                    </div>

                    {enableColumnResize && column.resizable !== false && (
                      <span
                        aria-hidden={true}
                        className="nxm-table-resize-handle"
                        onPointerDown={handleResizeStart(column.id, parsePxWidth(column.width))}
                      />
                    )}
                  </th>
                );
              })}
            </tr>

            {showFilters && (
              <tr className="nxm-table-filter-row">
                {visibleColumns.map((column) => (
                  <th className="nxm-table-filter-cell" key={column.id} scope="col">
                    {column.filter && (
                      <ColumnFilterControl
                        column={column}
                        filter={column.filter}
                        value={filters[column.id] ?? ""}
                        onChange={(value) => setColumnFilter(column.id, value)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="nxm-table-body">
            {isEmpty && <TableEmptyRow colSpan={colCount} emptyState={emptyState} />}

            {groups
              ? groups.map((group) => (
                  <TableGroupRow
                    collapsed={collapsedGroups.has(group.key)}
                    colSpan={colCount}
                    columns={visibleColumns}
                    getRowId={getRowId}
                    group={group}
                    key={group.key || "__empty"}
                    onToggleCollapsed={(collapsed) => setGroupCollapsed(group.key, collapsed)}
                  />
                ))
              : pageData.map((row) => (
                  <TableRow columns={visibleColumns} key={getRowId(row)} row={row} />
                ))}
          </tbody>
        </table>
      </div>

      {!groups && !!pageSize && (
        <Pagination
          className="nxm-table-pagination"
          currentPage={currentPage}
          recordsPerPage={pageSize}
          totalRecords={totalRecords}
          onPaginationUpdate={(page) => setPage(page)}
        />
      )}
    </div>
  );
};
