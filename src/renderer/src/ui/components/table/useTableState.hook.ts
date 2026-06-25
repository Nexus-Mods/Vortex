import { useMemo, useState } from "react";

import type {
  ICellValue,
  IColumnDef,
  ISortDirection,
  ISortState,
  ITableGroup,
} from "./Table.types";

const UNSPECIFIED_LABEL = "Unspecified";

const groupKeyOf = <T>(column: IColumnDef<T>, row: T): string =>
  column.groupValue ? column.groupValue(row) : String(column.getValue?.(row) ?? "");

interface IUseTableStateArgs<T> {
  columns: Array<IColumnDef<T>>;
  data: T[];
  /** Page size; when omitted, all rows render and pagination is disabled. */
  pageSize?: number;
}

const compareValues = (a: ICellValue, b: ICellValue): number => {
  // Nullish values always sort last regardless of direction.
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

const matchesFilter = <T>(column: IColumnDef<T>, row: T, value: string): boolean => {
  const { filter } = column;
  if (!filter) {
    return true;
  }

  if (filter.predicate) {
    return filter.predicate(row, value);
  }

  const cellValue = column.getValue?.(row);

  if (filter.type === "text") {
    return String(cellValue ?? "")
      .toLowerCase()
      .includes(value.toLowerCase());
  }

  return String(cellValue ?? "") === value;
};

export const useTableState = <T>({ columns, data, pageSize }: IUseTableStateArgs<T>) => {
  const [sort, setSort] = useState<ISortState | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [groupByColumnId, setGroupByColumnId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultHidden).map((column) => column.id)),
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumnIds.has(column.id)),
    [columns, hiddenColumnIds],
  );

  const filteredData = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, value]) => value !== "");
    if (activeFilters.length === 0) {
      return data;
    }

    return data.filter((row) =>
      activeFilters.every(([columnId, value]) => {
        const column = columns.find((candidate) => candidate.id === columnId);
        return column ? matchesFilter(column, row, value) : true;
      }),
    );
  }, [columns, data, filters]);

  const sortedData = useMemo(() => {
    if (!sort) {
      return filteredData;
    }

    const column = columns.find((candidate) => candidate.id === sort.columnId);
    if (!column) {
      return filteredData;
    }

    const comparator =
      column.sortFn ?? ((a: T, b: T) => compareValues(column.getValue?.(a), column.getValue?.(b)));

    // Copy before sorting so the source data array is never mutated.
    const sorted = [...filteredData].sort(comparator);
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [columns, filteredData, sort]);

  const totalRecords = sortedData.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;
  // Clamp the page when filtering/sorting shrinks the result set below it.
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    // No page size → pagination is disabled, render every row.
    if (!pageSize) {
      return sortedData;
    }
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // When grouping is active, build ordered groups across the whole (filtered +
  // sorted) dataset — grouping bypasses pagination. Groups appear in the order
  // their first row is encountered; the empty "Unspecified" bucket sorts last.
  const groups = useMemo<Array<ITableGroup<T>> | null>(() => {
    if (!groupByColumnId) {
      return null;
    }

    const column = columns.find((candidate) => candidate.id === groupByColumnId);
    if (!column) {
      return null;
    }

    const byKey = new Map<string, T[]>();
    for (const row of sortedData) {
      const key = groupKeyOf(column, row);
      const bucket = byKey.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        byKey.set(key, [row]);
      }
    }

    const entries = [...byKey.entries()].sort(([a], [b]) => {
      if (a === b) {
        return 0;
      }
      // Keep the empty "Unspecified" bucket at the end.
      if (a === "") {
        return 1;
      }
      if (b === "") {
        return -1;
      }
      return 0;
    });

    return entries.map(([key, rows]) => ({
      key,
      label:
        key === ""
          ? (column.groupLabel?.("") ?? UNSPECIFIED_LABEL)
          : (column.groupLabel?.(key) ?? key),
      rows,
    }));
  }, [columns, groupByColumnId, sortedData]);

  const toggleGroupBy = (columnId: string) => {
    setGroupByColumnId((current) => (current === columnId ? null : columnId));
    setCollapsedGroups(new Set());
  };

  const setGroupCollapsed = (groupKey: string, collapsed: boolean) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (collapsed) {
        next.add(groupKey);
      } else {
        next.delete(groupKey);
      }
      return next;
    });
  };

  const toggleSort = (columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      const next: ISortDirection = current.direction === "asc" ? "desc" : "asc";
      return { columnId, direction: next };
    });
  };

  const setColumnFilter = (columnId: string, value: string) => {
    setFilters((current) => ({ ...current, [columnId]: value }));
    setPage(1);
  };

  const setColumnHidden = (columnId: string, hidden: boolean) => {
    setHiddenColumnIds((current) => {
      const next = new Set(current);
      if (hidden) {
        next.add(columnId);
      } else {
        next.delete(columnId);
      }
      return next;
    });
  };

  return {
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
  };
};
