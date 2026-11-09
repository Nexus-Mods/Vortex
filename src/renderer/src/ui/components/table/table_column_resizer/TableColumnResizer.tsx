import React, { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useResizeHandle } from "@/ui/components/resize_handle/useResizeHandle.hook";

import { RESIZE_STEP } from "../table_column_resize/tableColumnResize";

interface ITableColumnResizerProps {
  /** The column's header, which names the handle. */
  header: string;
  /** The least the column can be resized to, in px. */
  minWidth: number;
  /** Takes the width while a drag is under way, or `undefined` once it's let go of. */
  onDrag: (width: number | undefined) => void;
  /** Takes the width it's resized to, or `undefined` to reset it. */
  onResize: (width: number | undefined) => void;
}

/**
 * The handle on a resizable column's header edge, resizing it as `useResizeHandle` does: no
 * narrower than its least; dragged, as wide as wanted, but from the keyboard no wider than the
 * table's visible width, which End takes it to. Read as a separator whose value is the width
 * the column's drawn at, in px.
 */
export const TableColumnResizer = ({
  header,
  minWidth,
  onDrag,
  onResize,
}: ITableColumnResizerProps) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ drawn: minWidth, table: 0 });

  useLayoutEffect(() => {
    const cell = ref.current?.parentElement;
    const table = ref.current?.closest<HTMLElement>(".nxm-table");
    if (!cell) {
      return undefined;
    }

    const measure = () =>
      setSize({
        drawn: Math.round(cell.getBoundingClientRect().width),
        table: Math.round(table?.clientWidth ?? 0),
      });
    measure();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(cell);
    if (table) {
      observer.observe(table);
    }
    return () => observer.disconnect();
  }, []);

  const drawn = Math.max(minWidth, size.drawn);
  const max = Math.max(drawn, size.table);

  const handle = useResizeHandle({
    value: drawn,
    min: minWidth,
    max,
    dragMax: Infinity,
    step: RESIZE_STEP,
    round: Math.round,
    dragTo: (clientX, start) => start.value + clientX - start.clientX,
    onChange: onResize,
    onReset: () => onResize(undefined),
    onDrag,
  });

  return (
    <div
      aria-label={t("Resize {{name}}", { name: header })}
      aria-orientation="vertical"
      aria-valuemax={Math.max(max, handle.value)}
      aria-valuemin={minWidth}
      aria-valuenow={handle.value}
      aria-valuetext={t("{{width}} pixels", { width: handle.value })}
      className="nxm-table-resize-handle"
      data-dragging={handle.dragging || undefined}
      ref={ref}
      role="separator"
      tabIndex={0}
      {...handle.handleProps}
    />
  );
};
