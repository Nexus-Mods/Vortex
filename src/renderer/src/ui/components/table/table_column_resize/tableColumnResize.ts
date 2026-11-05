import type { ITableColumn, TableColumnWidth } from "../Table.types";

/** A column without a width shares what's left, but never shrinks past this when columns overflow. */
export const DEFAULT_COLUMN_WIDTH: TableColumnWidth = "minmax(280px, 1fr)";

/** How far an arrow key resizes a column, in px. */
export const RESIZE_STEP = 16;

type SizedColumn = Pick<ITableColumn<unknown>, "width">;

/**
 * The least a column can be resized to: its width when that's `Npx`, or the least of a
 * `minmax(Npx, …)`. Unset for any other width, whose least can't be read in px.
 */
export const minColumnWidth = (column: SizedColumn): number | undefined => {
  const width = column.width ?? DEFAULT_COLUMN_WIDTH;
  const px = /^(\d+(?:\.\d+)?)px$/.exec(width) ?? /^minmax\((\d+(?:\.\d+)?)px,/.exec(width);
  return px ? Number(px[1]) : undefined;
};

/** Whether the user can resize a column: any whose least is known, unless it says not. */
export const isResizable = (column: Pick<ITableColumn<unknown>, "resizable" | "width">): boolean =>
  column.resizable !== false && minColumnWidth(column) !== undefined;

/** Whether a column shares what's left of the table's width with any others that do. */
export const sharesSpace = (column: SizedColumn): boolean =>
  (column.width ?? DEFAULT_COLUMN_WIDTH).includes("fr");

/**
 * A column's grid track: its own, or exactly the width it was resized to, which a column that
 * shared what's left then stops doing.
 */
export const columnTrack = (column: SizedColumn, width?: number): string => {
  if (width === undefined) {
    return column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return `${Math.max(width, minColumnWidth(column) ?? 0)}px`;
};

/**
 * The columns' grid tracks. In a table whose columns resize, once none shares what's left, a
 * gap takes it: before the sticky column, so that stays at the right, or after the last.
 */
export const columnTracks = (
  columns: Array<Pick<ITableColumn<unknown>, "width" | "resizable" | "sticky"> & { id: string }>,
  widthOf: (columnId: string) => number | undefined,
  resizes: boolean,
): string[] => {
  const tracks = columns.map((column) =>
    columnTrack(column, resizes && isResizable(column) ? widthOf(column.id) : undefined),
  );

  if (!resizes || tracks.some((track) => track.includes("fr"))) {
    return tracks;
  }

  const sticky = columns.findIndex((column) => column.sticky === "end");
  const gapAt = sticky === -1 ? tracks.length : sticky;
  return [...tracks.slice(0, gapAt), "minmax(0, 1fr)", ...tracks.slice(gapAt)];
};

/**
 * A width a column was resized to, worth keeping, no narrower than its least. A fixed column
 * keeps none at its least, which is its own width; one that shares what's left keeps it, as
 * its own would fill the table instead.
 */
export const keptWidth = (column: SizedColumn, width: number): number | undefined => {
  const least = minColumnWidth(column) ?? 0;
  const rounded = Math.max(Math.round(width), least);
  return rounded > least || sharesSpace(column) ? rounded : undefined;
};
