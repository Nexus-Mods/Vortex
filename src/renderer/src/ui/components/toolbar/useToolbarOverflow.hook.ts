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
  availableWidth: number | null;
  maxVisible?: number;
  metrics: IToolbarGroupMetrics | null;
  pinned: readonly boolean[];
}

interface IOverflowParams {
  maxVisible?: number;
  pinned: readonly boolean[];
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
 * Which actions render as buttons, by index. Pinned actions always do, wherever
 * they sit in the list; the unpinned ones then fill whatever room is left, in
 * order, so the tail of the row collapses first.
 *
 * Returning a set rather than a count is what lets a pin sit anywhere: the
 * visible actions are no longer necessarily a leading run of the list.
 *
 * A row too narrow for the pinned actions alone keeps them regardless — that is
 * what pinning asks for, so the group overflows rather than dropping them.
 */
export const fitVisibleActions = ({
  availableWidth,
  maxVisible,
  metrics,
  pinned,
}: IFitParams): Set<number> => {
  const slots = maxVisible ?? Number.POSITIVE_INFINITY;

  const pinnedIndices = pinned.flatMap((isPinned, index) => (isPinned ? [index] : []));
  const unpinnedIndices = pinned.flatMap((isPinned, index) => (isPinned ? [] : [index]));

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

  // Give up unpinned actions from the end until what's left fits.
  for (let taken = unpinnedIndices.length; taken >= 0; taken--) {
    const visible = [...pinnedIndices, ...unpinnedIndices.slice(0, taken)];
    const withKebab = taken < unpinnedIndices.length;

    if (visible.length + (withKebab ? 1 : 0) > slots) {
      continue;
    }

    if (fits(visible, withKebab)) {
      return new Set(visible);
    }
  }

  return new Set(pinnedIndices);
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
 * `pinned` is deliberately absent from `signature`: pinning changes which controls
 * show, not how wide any of them is, so the cached measurements still hold.
 */
export const useToolbarOverflow = ({ maxVisible, pinned, signature }: IOverflowParams) => {
  const actionCount = pinned.length;

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
    ? new Set(pinned.map((_, index) => index))
    : fitVisibleActions({
        availableWidth,
        maxVisible,
        metrics: measurement?.metrics ?? null,
        pinned,
      });

  return { groupRef, isMeasuring, visible };
};
