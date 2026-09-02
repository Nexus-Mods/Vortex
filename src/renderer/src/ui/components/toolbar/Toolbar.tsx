import React, {
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { type IToolbarContext, ToolbarContext } from "./Toolbar.context";

interface IToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Lets the user choose which actions sit on the bar, stored under this id. */
  pinningId?: string;
  /**
   * Opts this toolbar into tracking. Omitted, its controls report nothing —
   * see {@link IToolbarContext.tracking}.
   */
  tracking?: IToolbarContext["tracking"];
}

/**
 * The row's width followed by each child's, e.g. `"600:216:284"`. Doubles as the
 * store snapshot below: it's a string, so React can compare it by value, and it
 * changes exactly when a group needs to re-fit — the row resizing, or a sibling
 * collapsing and freeing space.
 */
const layoutSignature = (row: HTMLElement | null): string =>
  row ? [row.clientWidth, ...Array.from(row.children, (child) => child.clientWidth)].join(":") : "";

/** The row width a signature recorded, or `null` when the row isn't measurable. */
const rowWidthFrom = (signature: string): number | null => {
  const width = Number(signature.split(":")[0]);
  return Number.isFinite(width) && width > 0 ? width : null;
};

/**
 * Subscribes to the size of the row and of every child. Going through a store
 * rather than an effect means the measurement reaches a render without being
 * copied into state first, and React does the change detection.
 */
const useRowLayout = (row: HTMLElement | null): Omit<IToolbarContext, "pinningId" | "tracking"> => {
  const subscribe = useCallback(
    (onSizeChange: () => void) => {
      if (!row || typeof ResizeObserver === "undefined") {
        return () => undefined;
      }

      const sizes = new ResizeObserver(onSizeChange);
      const observeRow = () => {
        sizes.disconnect();
        sizes.observe(row);
        Array.from(row.children).forEach((child) => sizes.observe(child));
      };

      observeRow();

      if (typeof MutationObserver === "undefined") {
        return () => sizes.disconnect();
      }

      // Children are observed one by one, so the set has to be rebuilt whenever a
      // group is added or removed.
      const structure = new MutationObserver(() => {
        observeRow();
        onSizeChange();
      });

      structure.observe(row, { childList: true });

      return () => {
        sizes.disconnect();
        structure.disconnect();
      };
    },
    [row],
  );

  const signature = useSyncExternalStore(
    subscribe,
    useCallback(() => layoutSignature(row), [row]),
  );

  return useMemo(
    () => ({ element: row, signature, width: rowWidthFrom(signature) }),
    [row, signature],
  );
};

/**
 * Horizontal container for one or more {@link ToolbarGroup}s. Lays the groups
 * out in a row with consistent spacing; the visual "pill" surface lives on the
 * groups, not the toolbar itself.
 *
 * The toolbar measures the width available to it and shares it with its groups,
 * which move the controls that don't fit into their overflow menu. That needs a
 * width that doesn't come from the toolbar's own content, which a block-level or
 * stretched parent gives it for free.
 *
 * As a flex item it instead defaults to `flex-shrink: 0` and keeps every control,
 * because a toolbar sized by its content can't tell how much room it actually
 * has. Add a `flex-1` (or `shrink`) class to opt such a toolbar into collapsing.
 */
export const Toolbar = ({ children, className, pinningId, tracking, ...props }: IToolbarProps) => {
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const layout = useRowLayout(row);

  const context = useMemo<IToolbarContext>(
    () => ({ ...layout, pinningId: pinningId ?? null, tracking }),
    [layout, pinningId, tracking],
  );

  return (
    <ToolbarContext.Provider value={context}>
      <div
        className={joinClasses(["nxm-toolbar", className])}
        ref={setRow}
        role="toolbar"
        {...props}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
};
