import type { ITableColumn, TableColumnWidth } from "../Table.types";

/** A column without a width shares what's left, but never shrinks past this when columns overflow. */
export const DEFAULT_COLUMN_WIDTH: TableColumnWidth = "minmax(280px, 1fr)";

/** How far an arrow key resizes a column, in px. */
export const RESIZE_STEP = 16;

type ResizableColumn = Pick<ITableColumn<unknown>, "width">;

/** Whether the user can resize a column, which every column can unless it says not. */
export const isResizable = (column: Pick<ITableColumn<unknown>, "resizable">): boolean =>
  column.resizable !== false;

/** Whether a column shares what's left of the table's width with any others that do. */
export const sharesSpace = (column: ResizableColumn): boolean =>
  (column.width ?? DEFAULT_COLUMN_WIDTH).includes("fr");

/** The least a column can be resized to: its width in px, or the least of its `minmax`. */
export const minColumnWidth = (column: ResizableColumn): number =>
  Number(/(\d+(?:\.\d+)?)px/.exec(column.width ?? DEFAULT_COLUMN_WIDTH)?.[1] ?? 0);

/**
 * A column's grid track: its own, or exactly the width it was resized to, which a column that
 * shared what's left then stops doing.
 */
export const columnTrack = (column: ResizableColumn, width?: number): string => {
  if (width === undefined) {
    return column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return `${Math.max(width, minColumnWidth(column))}px`;
};

/**
 * The columns' grid tracks. Once none shares what's left, a gap takes it, before the sticky
 * column so that stays at the right, or after the last.
 */
export const columnTracks = (
  columns: Array<Pick<ITableColumn<unknown>, "width" | "resizable" | "sticky"> & { id: string }>,
  widthOf: (columnId: string) => number | undefined,
): string[] => {
  const tracks = columns.map((column) =>
    columnTrack(column, isResizable(column) ? widthOf(column.id) : undefined),
  );

  if (tracks.some((track) => track.includes("fr"))) {
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
export const keptWidth = (column: ResizableColumn, width: number): number | undefined => {
  const least = minColumnWidth(column);
  const rounded = Math.max(Math.round(width), least);
  return rounded > least || sharesSpace(column) ? rounded : undefined;
};
