import type { ITableVirtualRow } from "./useTableVirtualizer.hook";

/** A group's rendered rows, its heading's among them while it's in view. */
export interface ITableGroupBlock {
  /** The index of the group's heading among the table's rows. */
  heading: number;
  /** The height of the rows out of view between the block before and this one. */
  gap: number;
  /** Its rows rendered, each with the height of its group's rows out of view just before it. */
  rows: ITableVirtualRow[];
  /** The height of its group's rows out of view after the last one rendered. */
  endGap: number;
}

/**
 * The rendered rows by group, each block as tall as its whole group, so a heading sticks only
 * while its own rows pass and the next one pushes it off. `starts` is where each row starts,
 * with the table's height after the last; `headings` is every heading's index, in order.
 */
export const tableGroupBlocks = (
  rendered: number[],
  headings: number[],
  starts: number[],
): { blocks: ITableGroupBlock[]; endGap: number } => {
  const blocks: ITableGroupBlock[] = [];
  const total = starts[starts.length - 1] ?? 0;
  const end = (heading: number) => {
    const next = headings.find((candidate) => candidate > heading);
    return next ? starts[next] : total;
  };
  let cursor = 0;

  for (const index of rendered) {
    const heading = headings.findLast((candidate) => candidate <= index) ?? index;
    let block = blocks.at(-1);

    if (block?.heading !== heading) {
      if (block) {
        block.endGap = end(block.heading) - cursor;
        cursor = end(block.heading);
      }

      block = { heading, gap: starts[heading] - cursor, rows: [], endGap: 0 };
      cursor = starts[heading];
      blocks.push(block);
    }

    block.rows.push({ index, gap: starts[index] - cursor });
    cursor = starts[index + 1];
  }

  const last = blocks.at(-1);
  if (last) {
    last.endGap = end(last.heading) - cursor;
    cursor = end(last.heading);
  }

  return { blocks, endGap: total - cursor };
};
