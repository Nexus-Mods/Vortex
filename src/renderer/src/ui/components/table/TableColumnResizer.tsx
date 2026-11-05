import React, { type PointerEvent, useRef } from "react";
import { useTranslation } from "react-i18next";

import { hasModifierKey } from "@/ui/utils/hasModifierKey";

import { RESIZE_STEP } from "./table_column_resize/tableColumnResize";

interface ITableColumnResizerProps {
  /** The column's header, which names the handle. */
  header: string;
  /** The least the column can be resized to, in px. */
  minWidth: number;
  /** The width it was resized to, in px; unset while it's at its own. */
  width?: number;
  /** Takes the width while a drag is under way, or `undefined` once it's let go of. */
  onDrag: (width: number | undefined) => void;
  /** Takes the width it's resized to, or `undefined` to reset it. */
  onResize: (width: number | undefined) => void;
}

/** The width the handle's column is drawn at, which a drag or arrow key starts from. */
const cellWidth = (handle: HTMLElement) => handle.parentElement?.getBoundingClientRect().width ?? 0;

/**
 * The handle on a resizable column's header edge. Dragged, it widens the column, never past its
 * least; double-clicked, it resets it. From the keyboard, as a split's handle: the arrow keys
 * resize it a step at a time, Home takes it to its least and Enter resets it. Read as a
 * separator whose value is the column's width.
 */
export const TableColumnResizer = ({
  header,
  minWidth,
  width,
  onDrag,
  onResize,
}: ITableColumnResizerProps) => {
  const { t } = useTranslation();
  const drag = useRef<{ x: number; width: number; moved: boolean }>(undefined);

  const dragWidth = (event: PointerEvent<HTMLDivElement>) =>
    Math.max(minWidth, (drag.current?.width ?? 0) + event.clientX - (drag.current?.x ?? 0));

  return (
    <div
      aria-label={t("Resize {{name}}", { name: header })}
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuenow={width ?? minWidth}
      className="nxm-table-resize-handle"
      role="separator"
      tabIndex={0}
      onDoubleClick={() => onResize(undefined)}
      onKeyDown={(event) => {
        if (hasModifierKey(event)) {
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          onResize(undefined);
          return;
        }

        const drawn = cellWidth(event.currentTarget);
        const next = {
          ArrowLeft: drawn - RESIZE_STEP,
          ArrowRight: drawn + RESIZE_STEP,
          Home: minWidth,
        }[event.key];

        if (next !== undefined) {
          event.preventDefault();
          onResize(Math.max(minWidth, next));
        }
      }}
      onLostPointerCapture={() => {
        drag.current = undefined;
        onDrag(undefined);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { x: event.clientX, width: cellWidth(event.currentTarget), moved: false };
      }}
      onPointerMove={(event) => {
        if (drag.current === undefined) {
          return;
        }
        drag.current.moved = true;
        onDrag(dragWidth(event));
      }}
      onPointerUp={(event) => {
        if (drag.current?.moved) {
          onResize(dragWidth(event));
        }
        drag.current = undefined;
        onDrag(undefined);
      }}
    />
  );
};
