import type { ReactNode } from "react";

export type ISortDirection = "asc" | "desc";

export interface ISortState {
  columnId: string;
  direction: ISortDirection;
}

/** A primitive value a column can sort and filter on. */
export type ICellValue = string | number | boolean | null | undefined;

export type IColumnFilter<T> =
  | {
      type: "text";
      placeholder?: string;
      /**
       * Custom match. Defaults to a case-insensitive substring match against
       * `String(getValue(row))`.
       */
      predicate?: (row: T, query: string) => boolean;
    }
  | {
      type: "select";
      placeholder?: string;
      options: Array<{ label: string; value: string }>;
      /**
       * Custom match. Defaults to `String(getValue(row)) === value`.
       */
      predicate?: (row: T, value: string) => boolean;
    };

export interface IColumnDef<T> {
  /** Stable, unique identifier for the column. */
  id: string;
  /** Header label, also used as the accessible name for the column. */
  header: string;
  /**
   * Extracts the primitive value used for default sorting, filtering and cell
   * rendering. Omit when the column is purely presentational (e.g. an actions
   * column) and provide `cell` instead.
   */
  getValue?: (row: T) => ICellValue;
  /** Custom cell renderer. Falls back to `String(getValue(row))`. */
  cell?: (row: T) => ReactNode;
  /** Enables click-to-sort on the header. */
  sortable?: boolean;
  /** Custom comparator. Defaults to comparing `getValue` ascending. */
  sortFn?: (a: T, b: T) => number;
  /** Renders a filter control in the filter row beneath the header. */
  filter?: IColumnFilter<T>;
  /** Horizontal alignment for the body cells. Headers are always left. Default `left`. */
  align?: "left" | "center" | "right";
  /** Explicit column width as a CSS value (e.g. `"120px"`, `"20%"`). */
  width?: string;
  /** Whether the user may hide the column via the column toggle. Default `true`. */
  hideable?: boolean;
  /** Whether the column starts hidden. Default `false`. */
  defaultHidden?: boolean;
  /** Shows a group-by toggle on the header so rows can be grouped by this column. */
  groupable?: boolean;
  /**
   * Group key for a row when grouping by this column. Rows sharing a key form a
   * group. Defaults to `String(getValue(row) ?? "")`; an empty key is the
   * "Unspecified" group.
   */
  groupValue?: (row: T) => string;
  /** Display label for a group key. Defaults to the key (or "Unspecified" when empty). */
  groupLabel?: (key: string) => string;
}

export interface ITableGroup<T> {
  /** Group key (the raw `groupValue`; empty string for the "Unspecified" bucket). */
  key: string;
  /** Display label for the group header. */
  label: string;
  /** Rows belonging to this group, in sorted order. */
  rows: T[];
}

export interface ITableProps<T> {
  /** Column definitions, in display order. */
  columns: Array<IColumnDef<T>>;
  /** Full dataset. The table handles filtering, sorting and pagination. */
  data: T[];
  /** Returns a stable key for a row. */
  getRowId: (row: T) => string;
  /**
   * Rows rendered per page. When set, the table paginates and shows a pager;
   * when omitted, pagination is disabled and all rows render.
   */
  pageSize?: number;
  /** Accessible caption describing the table. */
  caption?: string;
  className?: string;
  /**
   * Renders the per-column filter row. Defaults to `true` when at least one
   * column defines a `filter`.
   */
  enableFilters?: boolean;
  /**
   * Renders the column toggle (gear) control. Defaults to `true` when at
   * least one column is hideable.
   */
  enableColumnToggle?: boolean;
  /** Node rendered when there are no rows to display. */
  emptyState?: ReactNode;
}
