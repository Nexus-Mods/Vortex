import { useLayoutEffect, useRef, useState } from "react";

import { useToolbarContext } from "./Toolbar.context";

/** Intrinsic widths of one group's controls, in CSS pixels. */
export interface IToolbarGroupMetrics {
  itemWidths: number[];
  kebabWidth: number;
  gap: number;
  padding: number;
}

interface IToolbarMeasurement {
  signature: string;
  metrics: IToolbarGroupMetrics;
}

interface IFitParams {
  actionCount: number;
  alwaysReserveOverflow?: boolean;
  availableWidth: number | null;
  maxVisible?: number;
  metrics: IToolbarGroupMetrics | null;
}

interface IOverflowParams {
  actionCount: number;
  alwaysReserveOverflow?: boolean;
  maxVisible?: number;
  signature: string;
}

/**
 * Marks the elements a group measures: one per action, and its overflow button.
 *
 * Measuring goes by these rather than by position among the group's children,
 * because a control is not always the only node it renders — Headless UI's
 * `Popover` puts a hidden sentinel span beside its element until it has resolved
 * its root container, so an action that opens a panel briefly occupies two slots.
 * Indexing past the actions to find the overflow button landed on that span, read
 * its width as 0, and left the group one control too wide.
 */
export const TOOLBAR_CONTROL_ATTRIBUTE = "data-toolbar-control";
export const TOOLBAR_OVERFLOW_ATTRIBUTE = "data-toolbar-overflow";

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
const measureGroup = (group: HTMLElement): IToolbarGroupMetrics => {
  const children = Array.from(group.children) as HTMLElement[];
  const style = getComputedStyle(group);

  return {
    itemWidths: children
      .filter((child) => child.hasAttribute(TOOLBAR_CONTROL_ATTRIBUTE))
      .map((child) => child.offsetWidth),
    kebabWidth:
      children.find((child) => child.hasAttribute(TOOLBAR_OVERFLOW_ATTRIBUTE))?.offsetWidth ?? 0,
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
 * Which actions render as buttons, by index: as many from the front as fit, so the
 * tail of the row collapses first.
 *
 * `alwaysReserveOverflow` is for a group whose menu is there whatever fits — a
 * toolbar offering pinning keeps the full list behind it — so the kebab's width
 * comes off the budget even when nothing has collapsed.
 */
export const fitVisibleActions = ({
  actionCount,
  alwaysReserveOverflow = false,
  availableWidth,
  maxVisible,
  metrics,
}: IFitParams): Set<number> => {
  const slots = maxVisible ?? Number.POSITIVE_INFINITY;

  const fits = (indices: number[], withKebab: boolean): boolean => {
    // `availableWidth` is checked against null rather than falsiness: 0 is a real
    // budget (a group with no room left), and must not be read as "not measured".
    if (!metrics || availableWidth === null) {
      return true;
    }

    const widths = indices.map((index) => metrics.itemWidths[index] ?? 0);

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

  // Give up actions from the end until what's left fits.
  for (let taken = actionCount; taken >= 0; taken--) {
    const visible = Array.from({ length: taken }, (_, index) => index);
    const withKebab = alwaysReserveOverflow || taken < actionCount;

    if (visible.length + (withKebab ? 1 : 0) > slots) {
      continue;
    }

    if (fits(visible, withKebab)) {
      return new Set(visible);
    }
  }

  return new Set();
};

/**
 * Decides which of a group's actions render as buttons, collapsing the rest into
 * the overflow menu once they no longer fit the width the toolbar has.
 *
 * Control widths are measured once, in a pass where the group renders everything
 * (`isMeasuring`), and cached against `signature`; resizing then only re-runs the
 * arithmetic in {@link fitVisibleActions}. Both passes happen in layout effects,
 * so the un-collapsed row is never painted.
 *
 * `signature` covers the controls the group renders, so unpinning one — which takes
 * it off the bar — re-measures, where the widths of those left are unchanged.
 */
export const useToolbarOverflow = ({
  actionCount,
  alwaysReserveOverflow,
  maxVisible,
  signature,
}: IOverflowParams) => {
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
    setMeasurement({ metrics: measureGroup(groupRef.current), signature });
  }, [isMeasuring, signature]);

  const minimumFootprint = measurement
    ? measurement.metrics.kebabWidth + measurement.metrics.padding
    : 0;

  useLayoutEffect(() => {
    setAvailableWidth(measureAvailableWidth(groupRef.current, row, rowWidth, minimumFootprint));
  }, [minimumFootprint, row, rowSignature, rowWidth]);

  const visible = isMeasuring
    ? new Set(Array.from({ length: actionCount }, (_, index) => index))
    : fitVisibleActions({
        actionCount,
        alwaysReserveOverflow,
        availableWidth,
        maxVisible,
        metrics: measurement?.metrics ?? null,
      });

  return { groupRef, isMeasuring, visible };
};
