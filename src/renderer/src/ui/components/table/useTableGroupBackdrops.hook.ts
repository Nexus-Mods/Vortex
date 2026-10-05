import { useMemo } from "react";

import type { ITableGroup, TableItem } from "./Table.types";
import type { ITableVirtualRow } from "./useTableVirtualizer.hook";

export interface ITableGroupBackdrop {
  /** The group's own row's key, unique among backdrops. */
  key: string;
  /** The group's picture, whose colour tints its rows. */
  src: string;
  /** The index of the group's first row. */
  first: number;
  /** The index of the group's last row. */
  last: number;
  /** Where its rows start, from the top of the table's first row. */
  top: number;
  /** The height of its rows. */
  height: number;
}

interface ITableGroupBackdropsOptions<T, G extends ITableGroup<T>> {
  /** A row's height, the same the virtualiser places it by. */
  getItemSize: (index: number) => number;
  /** Every row in the table, rendered or not. */
  items: Array<TableItem<T, G>>;
  /** The rows rendered, so only the groups in view get a backdrop. */
  rendered: ITableVirtualRow[];
}

// Where each open group with a picture has its rows.
const groupBackdrops = <T, G extends ITableGroup<T>>(
  items: Array<TableItem<T, G>>,
  getItemSize: (index: number) => number,
): ITableGroupBackdrop[] => {
  const backdrops: ITableGroupBackdrop[] = [];
  let current: ITableGroupBackdrop | undefined;
  let top = 0;

  items.forEach((item, index) => {
    const size = getItemSize(index);
    top += size;

    if (item.kind === "row") {
      if (current !== undefined) {
        current.last = index;
        current.height += size;
      }
      return;
    }

    current = undefined;
    if (item.expanded && !!item.group.image) {
      current = {
        key: item.key,
        src: item.group.image,
        first: index + 1,
        last: index,
        top,
        height: 0,
      };
      backdrops.push(current);
    }
  });

  return backdrops.filter((backdrop) => backdrop.height > 0);
};

/**
 * The tints behind the open groups in view, each placed over its group's rows from their
 * heights. Worked out once per change to the rows, not on every scroll; a group still
 * gets one when its own row has scrolled away.
 */
export const useTableGroupBackdrops = <T, G extends ITableGroup<T>>({
  getItemSize,
  items,
  rendered,
}: ITableGroupBackdropsOptions<T, G>): ITableGroupBackdrop[] => {
  const backdrops = useMemo(() => groupBackdrops(items, getItemSize), [items, getItemSize]);

  const firstRendered = rendered.at(0)?.index ?? 0;
  const lastRendered = rendered.at(-1)?.index ?? -1;

  return backdrops.filter(({ first, last }) => last >= firstRendered && first <= lastRendered);
};
