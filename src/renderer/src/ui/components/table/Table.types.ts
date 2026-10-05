import type { ReactNode } from "react";

/** A collapsible run of rows under a row of its own. */
export interface ITableGroup<T> {
  /** Stable, unique identifier for the group. */
  id: string;
  /** The group's name, which also names its collapse button. */
  label: string;
  rows: T[];
  /** A picture whose colours tint the group's row. */
  image?: string;
}

/**
 * A track that doesn't size to its content: the table only renders the rows in view, so
 * an `auto` track would change width as it scrolls.
 */
export type TableColumnWidth = `${number}px` | `${number}fr` | `minmax(${string})`;

export interface ITableColumn<T, G extends ITableGroup<T> = ITableGroup<T>> {
  /** Stable, unique identifier for the column. */
  id: string;
  /** Header label, also the column's accessible name. */
  header: string;
  cell: (row: T) => ReactNode;
  /** The column's cell in a group's row. The first column's follows the collapse button. */
  groupCell?: (group: G) => ReactNode;
  /** A grid track, e.g. `"minmax(0, 1fr)"` or `"206px"`. Default `"minmax(0, 1fr)"`. */
  width?: TableColumnWidth;
  /** Where the header and cells sit in the column. Default `start`. */
  align?: "start" | "end";
}

export type ITableProps<T, G extends ITableGroup<T> = ITableGroup<T>> = {
  columns: Array<ITableColumn<T, G>>;
  getRowId: (row: T) => string;
  /** The table's accessible name. */
  label: string;
  className?: string;
} & (
  | { rows: T[]; groups?: never }
  /** Grouped rows. A row can sit in more than one group. */
  | { groups: G[]; rows?: never }
);
