import type { ReactNode } from "react";

/** A collapsible run of rows under a row of its own. */
export interface ITableGroup<T> {
  /** Stable, unique identifier for the group. */
  id: string;
  /** The group's name, which also names its collapse button. */
  label: string;
  /** The rows under it, shown while it's open. */
  rows: T[];
  /** A picture whose colour tints the group's row and the rows under it. */
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
  /** The column's cell in an item's row. */
  cell: (row: T) => ReactNode;
  /** The column's cell in a group's row. The first column's follows the collapse button. */
  groupCell?: (group: G) => ReactNode;
  /** A grid track, e.g. `"minmax(120px, 1fr)"` or `"206px"`. Default `"minmax(280px, 1fr)"`. */
  width?: TableColumnWidth;
  /** Where the header and cells sit in the column. Default `start`. */
  align?: "start" | "end";
  /** `end` keeps the last column at the right of the view while the columns overflow. */
  sticky?: "end";
  /** For a sticky column, how far its cell widens over the cells before it while its row is hovered. */
  revealWidth?: `${number}px`;
  /** Makes the column sortable: compares two rows for A to Z, as `Array.sort` does. */
  sort?: (a: T, b: T) => number;
}

/** The column the rows are sorted by, and which way. */
export interface ITableSort {
  /** The sorted column's `id`. */
  columnId: string;
  /** A to Z, or Z to A; the values `aria-sort` takes. */
  direction: "ascending" | "descending";
}

export type ITableProps<T, G extends ITableGroup<T> = ITableGroup<T>> = {
  /** The columns, in order, each making a track of the table's grid. */
  columns: Array<ITableColumn<T, G>>;
  /** A row's stable, unique id, which keys it across renders. */
  getRowId: (row: T) => string;
  /** The table's accessible name. */
  label: string;
  /** Controls above the header row, in the sticky head: a page's tabs and actions. */
  toolbar?: ReactNode;
  /** The sort to start with; unset, the rows keep the order they're given in. */
  defaultSort?: ITableSort;
  /** Classes for the table's grid element. */
  className?: string;
  /** Lets rows be selected, each from a checkbox at its start, every row from the header's. */
  selectable?: boolean;
  /** A row's name, for its checkbox. */
  getRowLabel?: (row: T) => string;
} & (
  | {
      /** The rows, ungrouped. */
      rows: T[];
      groups?: never;
    }
  | {
      /** Grouped rows. A row can sit in more than one group. */
      groups: G[];
      rows?: never;
    }
);

/** One of the table's rows as it renders them: an item's row, or a group's own row. */
export type TableItem<T, G> =
  | {
      kind: "row";
      /** Unique among the table's rows; a row in two groups has a key for each. */
      key: string;
      /** The item the row shows. */
      row: T;
      /** 2 under a group, unset in a flat grid. */
      level?: number;
      /** The picture of the group it's under, which tints it. */
      tint?: string;
    }
  | {
      kind: "group";
      /** Unique among the table's rows. */
      key: string;
      /** The group the row heads. */
      group: G;
      /** Whether the group's rows are showing. */
      expanded: boolean;
    };
