import React, {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
  openedFromKeyboard,
} from "@/ui/components/context_menu/ContextMenu";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarMenu } from "@/ui/components/toolbar/ToolbarMenu";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { ITableGroup, ITableProps, TableItem } from "./Table.types";
import { TableGroup } from "./TableGroup";
import { tableGroupBlocks } from "./tableGroupBlocks";
import { tableGroupMenuActions } from "./TableGroupMenu";
import { TableGroupRow } from "./TableGroupRow";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { TableSpacer } from "./TableSpacer";
import { useTableSelection } from "./useTableSelection.hook";
import { useTableSort } from "./useTableSort.hook";
import { useTableVirtualizer } from "./useTableVirtualizer.hook";

// Fixed, so the virtualiser knows every row's height without measuring; table.css reads them.
const ROW_HEIGHT = 40;
const GROUP_ROW_HEIGHT = 48;
const GROUP_ROW_GAP = 4;

/** A column without a width shares what's left, but never shrinks past this when columns overflow. */
const DEFAULT_COLUMN_WIDTH = "minmax(280px, 1fr)";

/**
 * A column-driven table drawn as one CSS grid: the columns' widths make its tracks, and
 * every row is a subgrid of them, so cells line up across rows without a `<table>`.
 * Carries the grid roles, so it reads as a table to assistive tech; grouped, it's a
 * treegrid whose group rows collapse. Only the rows in view render, against the page's
 * scroller, under a header that sticks to it. A right-click on a row offers its `rowMenu`, once
 * the row is selected. Every selected row shows what's in it as a hovered one does, so a table
 * that shows actions in its rows decides itself what several selected rows show.
 *
 * Each group's heading and rows render in a rowgroup as tall as all its rows, rendered or not,
 * so the heading sticks under the header while they pass and the next group's pushes it off.
 *
 * A group heading has a "…" at its end, in the sticky column or the last, and a right-click menu,
 * both listing the same items, drawn by the toolbar components as a row's are. First the table's
 * built-in items, each with a stable id (`collapse`, `collapse-all`, `select-all`): collapsing or
 * expanding the group or every group, and selecting its rows. Then the page's `groupMenu` actions.
 * The heading's toolbar counts every click through `groupTracking`, as a row's toolbar counts its
 * own; the built-ins say in `trackingProperties` which way they went.
 *
 * Given `focusGroupId`, it opens that group and scrolls it to the top once it has it; the group
 * opens while rendering, so its rows are counted before it's scrolled to.
 */
export const Table = <T, G extends ITableGroup<T> = ITableGroup<T>>({
  columns,
  rows,
  groups,
  getRowId,
  label,
  toolbar,
  footer,
  empty,
  defaultSort,
  className,
  selectable = false,
  getRowLabel,
  selectedIds,
  onSelectedIdsChange,
  rowMenu,
  groupMenu,
  groupTracking,
  focusGroupId,
  onGroupFocused,
  onMenuOpen,
}: ITableProps<T, G>) => {
  const { t } = useTranslation();
  const { sort, sortRows, toggleSort } = useTableSort(columns, defaultSort);

  // Each row once, though a row in two groups shows in both.
  const rowIds = useMemo(
    () => [...new Set((rows ?? groups?.flatMap((group) => group.rows) ?? []).map(getRowId))],
    [getRowId, groups, rows],
  );

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (groupId: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(groupId)) {
        next.add(groupId);
      }
      return next;
    });

  const [menu, setMenu] = useState<
    | { position: IContextMenuPosition; kind: "row"; rowId: string }
    | { position: IContextMenuPosition; kind: "group"; groupId: string }
  >();

  const menuGroup =
    menu?.kind === "group" ? groups?.find((group) => group.id === menu.groupId) : undefined;

  const menuRow =
    menu?.kind === "row"
      ? (rows ?? groups?.flatMap((group) => group.rows))?.find(
          (row) => getRowId(row) === menu.rowId,
        )
      : undefined;

  // Closed while rendering once what it was opened on is gone, so it never shows a frame for nothing.
  if ((menu?.kind === "group" && !menuGroup) || (menu?.kind === "row" && menuRow === undefined)) {
    setMenu(undefined);
  }

  // Every row in order, a group's under it while it's open, as the virtualiser counts them.
  const items = useMemo<Array<TableItem<T, G>>>(() => {
    if (groups === undefined) {
      return sortRows(rows).map((row) => ({ kind: "row", key: getRowId(row), row }));
    }

    return groups.flatMap((group): Array<TableItem<T, G>> => {
      const expanded = !collapsed.has(group.id);

      const groupItem: TableItem<T, G> = {
        kind: "group",
        key: `group:${group.id}`,
        group,
        expanded,
      };

      if (!expanded) {
        return [groupItem];
      }

      return [
        groupItem,
        ...sortRows(group.rows).map(
          (row): TableItem<T, G> => ({
            kind: "row",
            key: `${group.id}:${getRowId(row)}`,
            row,
            level: 2,
          }),
        ),
      ];
    });
  }, [collapsed, getRowId, groups, rows, sortRows]);

  const shownRows = useMemo(
    () =>
      items.flatMap((item) =>
        item.kind === "row" ? [{ key: item.key, id: getRowId(item.row) }] : [],
      ),
    [getRowId, items],
  );

  const selection = useTableSelection(rowIds, shownRows, selectedIds, onSelectedIdsChange);

  const groupMenuOptions = (group: G) => ({
    allSelected:
      !!group.rows.length && group.rows.every((row) => selection.selected.has(getRowId(row))),
    expanded: !collapsed.has(group.id),
    onDeselectAll: selectable ? () => selection.remove(group.rows.map(getRowId)) : undefined,
    onSelectAll: selectable ? () => selection.add(group.rows.map(getRowId)) : undefined,
    onSetAllExpanded: (expanded: boolean) =>
      setCollapsed(new Set(expanded ? [] : (groups ?? []).map((other) => other.id))),
    onToggle: () => toggle(group.id),
  });

  const groupActions = (group: G) => [
    ...tableGroupMenuActions({ ...groupMenuOptions(group), t }),
    ...(groupMenu?.(group) ?? []),
  ];

  const getItemKey = useCallback((index: number) => items[index].key, [items]);
  const getItemSize = useCallback(
    (index: number) =>
      items[index].kind === "group" ? GROUP_ROW_HEIGHT + GROUP_ROW_GAP : ROW_HEIGHT,
    [items],
  );

  const stickyIndexes = useMemo(
    () => items.flatMap((item, index) => (item.kind === "group" ? [index] : [])),
    [items],
  );

  const virtual = useTableVirtualizer({
    count: items.length,
    getItemKey,
    getItemSize,
    stickyIndexes,
  });

  const hasFocusGroup = !!focusGroupId && !!groups?.some((group) => group.id === focusGroupId);

  if (hasFocusGroup && collapsed.has(focusGroupId)) {
    const next = new Set(collapsed);
    next.delete(focusGroupId);
    setCollapsed(next);
  }

  const { ready, scrollToIndex } = virtual;

  useEffect(() => {
    if (!hasFocusGroup || !ready) {
      return;
    }

    const index = items.findIndex((item) => item.key === `group:${focusGroupId}`);
    if (index === -1) {
      return;
    }

    scrollToIndex(index);
    onGroupFocused?.();
  }, [focusGroupId, hasFocusGroup, items, onGroupFocused, ready, scrollToIndex]);

  const revealWidth = columns.find((column) => column.sticky === "end")?.revealWidth;

  // The rows in the sticky head, which come before the table's own in aria-rowindex.
  const headRows = toolbar ? 2 : 1;
  const showsEmpty = items.length === 0 && !!empty;
  // The rows after the head: the items, or what stands in for them.
  const bodyRows = showsEmpty ? 1 : items.length;

  const starts = useMemo(() => {
    const tops = [0];
    items.forEach((_, index) => tops.push(tops[index] + getItemSize(index)));
    return tops;
  }, [getItemSize, items]);

  // The toolbar grows as what's in it wraps, and the head and the scroll margins reckon with its
  // height, so it's measured into the variable they read.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState<number>();
  const hasToolbar = !!toolbar;

  useLayoutEffect(() => {
    const element = toolbarRef.current;
    if (element === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => setToolbarHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasToolbar]);

  const renderItem = (index: number) => {
    const item = items[index];

    if (item.kind === "group") {
      return (
        <TableGroupRow
          columns={columns}
          expanded={item.expanded}
          group={item.group}
          index={index}
          menu={
            <Toolbar className="ml-auto pl-1" tracking={groupTracking}>
              <ToolbarGroup actions={groupActions(item.group)} maxVisible={0} />
            </Toolbar>
          }
          rowIndex={index + headRows + 1}
          onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            onMenuOpen?.("group", openedFromKeyboard(event) ? "keyboard" : "pointer");
            setMenu({
              position: contextMenuPosition(event),
              kind: "group",
              groupId: item.group.id,
            });
          }}
          onToggle={() => toggle(item.group.id)}
        />
      );
    }

    return (
      <TableRow
        checkbox={
          selectable
            ? selection.checkbox({ key: item.key, id: getRowId(item.row) }, getRowLabel?.(item.row))
            : undefined
        }
        columns={columns}
        index={index}
        level={item.level}
        row={item.row}
        rowIndex={index + headRows + 1}
        sortedColumnId={sort?.columnId}
        onClick={
          selectable
            ? (click) => selection.click({ key: item.key, id: getRowId(item.row) }, click)
            : undefined
        }
        onContextMenu={
          rowMenu
            ? (event) => {
                event.preventDefault();
                const id = getRowId(item.row);
                const inSelection =
                  selectable && selection.selected.has(id) && selection.selected.size > 1;
                onMenuOpen?.(
                  inSelection ? "selection" : "row",
                  openedFromKeyboard(event) ? "keyboard" : "pointer",
                );
                if (selectable) {
                  selection.contextClick({ key: item.key, id });
                }
                setMenu({
                  position: contextMenuPosition(event),
                  kind: "row",
                  rowId: getRowId(item.row),
                });
              }
            : undefined
        }
      />
    );
  };

  const blocks = tableGroupBlocks(
    virtual.items.map(({ index }) => index),
    stickyIndexes,
    starts,
  );

  return (
    <div
      aria-label={label}
      aria-rowcount={bodyRows + headRows + (footer ? 1 : 0)}
      className={joinClasses(["nxm-table", className])}
      data-sticky-reveal={revealWidth ? "" : undefined}
      data-toolbar={toolbar ? "" : undefined}
      ref={virtual.tableRef}
      role={groups === undefined ? "grid" : "treegrid"}
      style={
        {
          "--nxm-table-row-height": `${ROW_HEIGHT}px`,
          "--nxm-table-group-row-height": `${GROUP_ROW_HEIGHT}px`,
          "--nxm-table-group-row-gap": `${GROUP_ROW_GAP}px`,
          "--nxm-table-sticky-reveal": revealWidth,
          "--nxm-table-toolbar-height": toolbarHeight ? `${toolbarHeight}px` : undefined,
          gridTemplateColumns: [
            "var(--nxm-table-gutter-start)",
            ...columns.map((column) => column.width ?? DEFAULT_COLUMN_WIDTH),
            "var(--nxm-table-gutter)",
          ].join(" "),
        } as CSSProperties
      }
      onBlur={virtual.onBlur}
      onClick={(event) => {
        // Between and below the rows, but not the head; a portalled panel isn't in the table.
        const target = event.target as Element;
        if (
          selectable &&
          event.currentTarget.contains(target) &&
          target.closest('[role="row"], .nxm-table-head') === null
        ) {
          selection.clear();
        }
      }}
      onFocus={virtual.onFocus}
    >
      <TableHeader
        checkbox={selectable ? selection.header : undefined}
        columns={columns}
        sort={sort}
        toolbar={toolbar}
        toolbarRef={toolbarRef}
        onSort={toggleSort}
      />

      {/* Always rendered, at the top of the rows: where the virtualiser measures from. */}
      <div className="nxm-table-spacer" ref={virtual.startRef} role="presentation" />

      {!groups &&
        virtual.items.map(({ gap, index }) => (
          <Fragment key={items[index].key}>
            {/* Rows out of view, before a focused row kept far from the rest too. */}
            <TableSpacer height={gap} />
            {renderItem(index)}
          </Fragment>
        ))}

      {!!groups &&
        blocks.blocks.map(({ endGap, gap, heading, rows: blockRows }) => {
          const item = items[heading];

          return (
            <Fragment key={`block:${item.key}`}>
              <TableSpacer height={gap} />
              <TableGroup image={item.kind === "group" ? item.group.image : undefined}>
                {blockRows.map((row) => (
                  <Fragment key={items[row.index].key}>
                    <TableSpacer height={row.gap} />
                    {renderItem(row.index)}
                  </Fragment>
                ))}
                <TableSpacer height={endGap} />
              </TableGroup>
            </Fragment>
          );
        })}

      <TableSpacer height={groups ? blocks.endGap : virtual.endGap} />

      {showsEmpty && (
        <div aria-rowindex={headRows + 1} className="nxm-table-empty" role="row">
          <div aria-colspan={columns.length} className="nxm-table-empty-cell" role="gridcell">
            {empty}
          </div>
        </div>
      )}

      <ContextMenu position={menu?.position} onClose={() => setMenu(undefined)}>
        {(close) => {
          if (menu?.kind === "group") {
            if (!menuGroup) {
              return null;
            }

            return (
              <ToolbarMenu
                actions={groupActions(menuGroup)}
                label={t("{{name}} group actions", { name: menuGroup.label })}
                tracking={groupTracking}
                onSelect={close}
              />
            );
          }

          return menuRow === undefined ? null : rowMenu?.(menuRow, close);
        }}
      </ContextMenu>

      {!!footer && (
        <div aria-rowindex={bodyRows + headRows + 1} className="nxm-table-footer" role="row">
          <div aria-colspan={columns.length} className="nxm-table-footer-cell" role="gridcell">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};
