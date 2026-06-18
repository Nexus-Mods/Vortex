import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Smallest width (px) a column can be dragged down to. */
const MIN_COLUMN_WIDTH = 48;

interface IDragState {
  columnId: string;
  startX: number;
  startWidth: number;
  currentWidth: number;
}

interface IUseColumnResizeOptions {
  /**
   * Widths (px) to start from, keyed by column id — e.g. values restored from
   * persistence. Read once when the hook mounts.
   */
  initialWidths?: Record<string, number>;
  /**
   * Fires with the complete width map (rounded to whole px) whenever a resize
   * finishes or the widths are reset. The caller can persist this however it
   * likes; an empty map means "no custom widths".
   */
  onChange?: (widths: Record<string, number>) => void;
}

const roundWidths = (widths: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(widths).map(([id, width]) => [id, Math.round(width)]));

/**
 * Manages user-driven column resizing via a drag handle in the header. Widths
 * are tracked in pixels, keyed by column id, and applied to the table's
 * `<col>` elements. `onChange` reports the full width map once a drag finishes
 * or the widths are reset, so it can be persisted by the caller.
 */
export const useColumnResize = ({ initialWidths, onChange }: IUseColumnResizeOptions = {}) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => initialWidths ?? {},
  );
  const dragRef = useRef<IDragState | null>(null);

  // Mirror the latest widths and callback in refs so the pointer handlers (set
  // up once) always see current values without being re-created each render.
  const widthsRef = useRef(columnWidths);
  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleResizeStart = useCallback(
    // `minWidth` is the smallest width (px) the column can be dragged to —
    // typically the column's configured width, so it can't shrink below its
    // initial size.
    (columnId: string, minWidth: number = MIN_COLUMN_WIDTH) =>
      (event: ReactPointerEvent<HTMLElement>) => {
        // Don't let the drag trigger the header's sort/group buttons.
        event.preventDefault();
        event.stopPropagation();

        const th = event.currentTarget.closest("th");
        const table = event.currentTarget.closest("table");
        if (!th || !table) {
          return;
        }

        // Pin every column to its current rendered width up-front. The table
        // uses `table-layout: fixed; width: 100%`, so without this the browser
        // redistributes the remaining columns the instant one is given an
        // explicit width — making the grabbed edge jump away from the cursor.
        // Measuring all columns first means their widths already sum to the
        // table width, so nothing reflows on drag start.
        const measured: Record<string, number> = {};
        table.querySelectorAll<HTMLElement>("th[data-column-id]").forEach((cell) => {
          const id = cell.dataset.columnId;
          if (id) {
            measured[id] = cell.getBoundingClientRect().width;
          }
        });

        const startWidth = measured[columnId] ?? th.getBoundingClientRect().width;
        const floor = Math.min(minWidth, startWidth);
        dragRef.current = { columnId, startX: event.clientX, startWidth, currentWidth: startWidth };

        // Keep any previously resized widths; backfill the rest from the live
        // measurements so the whole table is now explicitly sized.
        setColumnWidths((current) => ({ ...measured, ...current }));

        document.body.classList.add("nxm-table-resizing");

        const handleMove = (moveEvent: PointerEvent) => {
          const drag = dragRef.current;
          if (!drag) {
            return;
          }
          const next = Math.max(floor, drag.startWidth + (moveEvent.clientX - drag.startX));
          drag.currentWidth = next;
          setColumnWidths((current) => ({ ...current, [drag.columnId]: next }));
        };

        const handleEnd = () => {
          const drag = dragRef.current;
          dragRef.current = null;
          document.body.classList.remove("nxm-table-resizing");
          document.removeEventListener("pointermove", handleMove);
          document.removeEventListener("pointerup", handleEnd);
          if (drag) {
            // Report the full, current map (with the just-dragged column's final
            // width) so it can be persisted as a unit.
            onChangeRef.current?.(
              roundWidths({ ...widthsRef.current, [drag.columnId]: drag.currentWidth }),
            );
          }
        };

        document.addEventListener("pointermove", handleMove);
        document.addEventListener("pointerup", handleEnd);
      },
    [],
  );

  const resetColumnWidths = useCallback(() => {
    setColumnWidths({});
    onChangeRef.current?.({});
  }, []);

  const hasCustomWidths = Object.keys(columnWidths).length > 0;

  return { columnWidths, handleResizeStart, hasCustomWidths, resetColumnWidths };
};
