import { useLayoutEffect, useRef, useState } from "react";

import { useToolbarContext } from "./Toolbar.context";

/** Intrinsic widths of one group's controls, in CSS pixels. */
export interface IToolbarGroupMetrics {
  /** Width of each action button, in action order. */
  itemWidths: number[];
  /** Width of the overflow kebab. */
  kebabWidth: number;
  /** Gap between two adjacent controls. */
  gap: number;
  /** Combined left and right padding of the pill surface. */
  padding: number;
}

interface IToolbarMeasurement {
  signature: string;
  metrics: IToolbarGroupMetrics;
}

interface IFitParams {
  actionCount: number;
  availableWidth: number | null;
  maxVisible?: number;
  metrics: IToolbarGroupMetrics | null;
}

interface IOverflowParams {
  actionCount: number;
  maxVisible?: number;
  /** Changes whenever the actions' rendered widths could have changed. */
  signature: string;
}

const parsePx = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Reads the intrinsic width of every control in the group. Only valid while the
 * group renders all of its actions plus the kebab, and relies on
 * `.nxm-toolbar-group > *` being `flex-shrink: 0` so the widths hold even in the
 * frame where the row is too narrow to hold them all.
 */
const measureGroup = (group: HTMLElement, actionCount: number): IToolbarGroupMetrics => {
  const widths = Array.from(group.children, (child) => (child as HTMLElement).offsetWidth);
  const style = getComputedStyle(group);

  return {
    itemWidths: widths.slice(0, actionCount),
    kebabWidth: widths[actionCount] ?? 0,
    gap: parsePx(style.columnGap),
    padding: parsePx(style.paddingLeft) + parsePx(style.paddingRight),
  };
};

/**
 * Width left for `group` once everything ahead of it in the row is placed, less a
 * reserve for what comes after it.
 *
 * Only the *measured* width of preceding siblings counts, so a group's budget
 * never depends on its own width — that's what stops one collapse from feeding
 * another. Following siblings can't be measured without that circularity, so each
 * is reserved `minimumFootprint`: a group always keeps its overflow menu, and
 * claiming the whole row would push a later group out of it. Every group uses the
 * same control size, so its own footprint is a good estimate of a sibling's.
 */
const measureAvailableWidth = (
  group: HTMLElement | null,
  row: HTMLElement | null,
  rowWidth: number | null,
  minimumFootprint: number,
): number | null => {
  if (!group || !row || rowWidth === null) {
    return null;
  }

  const gap = parsePx(getComputedStyle(row).columnGap);
  let used = 0;

  for (let ahead = group.previousElementSibling; ahead; ahead = ahead.previousElementSibling) {
    used += (ahead as HTMLElement).offsetWidth + gap;
  }

  for (let after = group.nextElementSibling; after; after = after.nextElementSibling) {
    used += minimumFootprint + gap;
  }

  return Math.max(0, rowWidth - used);
};

/**
 * Largest number of action buttons that fits `availableWidth` without exceeding
 * the `maxVisible` slot cap. A result below `actionCount` means the kebab is
 * rendered and takes one of those slots.
 */
export const fitVisibleCount = ({
  actionCount,
  availableWidth,
  maxVisible,
  metrics,
}: IFitParams): number => {
  const slots = maxVisible ?? Number.POSITIVE_INFINITY;

  const fits = (count: number, withKebab: boolean): boolean => {
    // `availableWidth` is checked against null rather than falsiness: 0 is a real
    // budget (a group with no room left), and must not be read as "not measured".
    if (!metrics || availableWidth === null) {
      return true;
    }

    const widths = metrics.itemWidths.slice(0, count);

    if (withKebab) {
      widths.push(metrics.kebabWidth);
    }

    if (widths.length === 0) {
      return true;
    }

    return (
      widths.reduce((total, width) => total + width, 0) +
        metrics.gap * (widths.length - 1) +
        metrics.padding <=
      availableWidth
    );
  };

  if (actionCount <= slots && fits(actionCount, false)) {
    return actionCount;
  }

  for (let count = Math.min(actionCount - 1, slots - 1); count > 0; count--) {
    if (fits(count, true)) {
      return count;
    }
  }

  return 0;
};

/**
 * Decides how many of a group's actions to render as buttons, collapsing the
 * rest into the overflow menu once they no longer fit the width the toolbar has.
 *
 * Control widths are measured once, in a pass where the group renders everything
 * (`isMeasuring`), and cached against `signature`; resizing then only re-runs the
 * arithmetic in {@link fitVisibleCount}. Both passes happen in layout effects, so
 * the un-collapsed row is never painted.
 */
export const useToolbarOverflow = ({ actionCount, maxVisible, signature }: IOverflowParams) => {
  const { element: row, signature: rowSignature, width: rowWidth } = useToolbarContext();

  const groupRef = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<IToolbarMeasurement | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  const isMeasuring = !!actionCount && measurement?.signature !== signature;

  useLayoutEffect(() => {
    if (!isMeasuring || !groupRef.current) {
      return;
    }

    // Writing to state from an effect is the mechanism here, not an oversight:
    // the widths only exist once the controls are in the DOM, so the pass that
    // renders them all has to hand what it measured to the pass that collapses
    // them. Runs at most once per distinct action list, before paint.
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setMeasurement({ metrics: measureGroup(groupRef.current, actionCount), signature });
  }, [actionCount, isMeasuring, signature]);

  const minimumFootprint = measurement
    ? measurement.metrics.kebabWidth + measurement.metrics.padding
    : 0;

  useLayoutEffect(() => {
    setAvailableWidth(measureAvailableWidth(groupRef.current, row, rowWidth, minimumFootprint));
  }, [minimumFootprint, row, rowSignature, rowWidth]);

  const visibleCount = isMeasuring
    ? actionCount
    : fitVisibleCount({
        actionCount,
        availableWidth,
        maxVisible,
        metrics: measurement?.metrics ?? null,
      });

  return { groupRef, isMeasuring, visibleCount };
};
