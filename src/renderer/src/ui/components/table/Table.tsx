import React, {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
  openedFromKeyboard,
} from "@/ui/components/context_menu/ContextMenu";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { ITableGroup, ITableProps, TableItem } from "./Table.types";
import { TableGroupBackdrop } from "./TableGroupBackdrop";
import { TableGroupMenu } from "./TableGroupMenu";
import { TableGroupRow } from "./TableGroupRow";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { TableSpacer } from "./TableSpacer";
import { useTableGroupBackdrops } from "./useTableGroupBackdrops.hook";
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
 * scroller, under a header that sticks to it. A right-click on a group row offers to collapse
 * or expand it or every group, and to select its rows; then its `groupMenu`; on a row, its
 * `rowMenu`, once the row is selected. Every selected row shows what's in it as a hovered one
 * does, so a table
 * that shows actions in its rows decides itself what several selected rows show.
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
  onMenuOpen,
  onGroupMenuAction,
}: ITableProps<T, G>) => {
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
            tint: group.image,
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

  const getItemKey = useCallback((index: number) => items[index].key, [items]);
  const getItemSize = useCallback(
    (index: number) =>
      items[index].kind === "group" ? GROUP_ROW_HEIGHT + GROUP_ROW_GAP : ROW_HEIGHT,
    [items],
  );

  const virtual = useTableVirtualizer({ count: items.length, getItemKey, getItemSize });
  const revealWidth = columns.find((column) => column.sticky === "end")?.revealWidth;

  // The rows in the sticky head, which come before the table's own in aria-rowindex.
  const headRows = toolbar ? 2 : 1;
  const showsEmpty = items.length === 0 && !!empty;
  // The rows after the head: the items, or what stands in for them.
  const bodyRows = showsEmpty ? 1 : items.length;

  const backdrops = useTableGroupBackdrops({ getItemSize, items, rendered: virtual.items });

  // The toolbar grows as what's in it wraps, and the head, the scroll margins and the group
  // backdrops all reckon with its height, so it's measured into the variable they read.
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
          target.closest('[role="row"], [role="rowgroup"]') === null
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

      {/* Behind the groups in view, even one whose own row has scrolled away. */}
      {backdrops.map(({ height, key, src, top }) => (
        <TableGroupBackdrop height={height} key={`backdrop:${key}`} src={src} top={top} />
      ))}

      {virtual.items.map(({ gap, index }) => {
        const item = items[index];

        return (
          <Fragment key={item.key}>
            {/* Rows out of view, before a focused row kept far from the rest too. */}
            <TableSpacer height={gap} />

            {item.kind === "group" ? (
              <TableGroupRow
                columns={columns}
                expanded={item.expanded}
                group={item.group}
                index={index}
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
            ) : (
              <TableRow
                checkbox={
                  selectable
                    ? selection.checkbox(
                        { key: item.key, id: getRowId(item.row) },
                        getRowLabel?.(item.row),
                      )
                    : undefined
                }
                columns={columns}
                index={index}
                level={item.level}
                row={item.row}
                rowIndex={index + headRows + 1}
                sortedColumnId={sort?.columnId}
                tint={item.tint}
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
            )}
          </Fragment>
        );
      })}

      <TableSpacer height={virtual.endGap} />

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
              <TableGroupMenu
                allSelected={
                  !!menuGroup.rows.length &&
                  menuGroup.rows.every((row) => selection.selected.has(getRowId(row)))
                }
                expanded={!collapsed.has(menuGroup.id)}
                extra={groupMenu?.(menuGroup)}
                label={menuGroup.label}
                onDeselectAll={
                  selectable
                    ? () => {
                        onGroupMenuAction?.("deselect_all");
                        selection.remove(menuGroup.rows.map(getRowId));
                      }
                    : undefined
                }
                onSelect={close}
                onSelectAll={
                  selectable
                    ? () => {
                        onGroupMenuAction?.("select_all");
                        selection.add(menuGroup.rows.map(getRowId));
                      }
                    : undefined
                }
                onSetAllExpanded={(expanded) => {
                  onGroupMenuAction?.(expanded ? "expand_all" : "collapse_all");
                  setCollapsed(new Set(expanded ? [] : (groups ?? []).map((group) => group.id)));
                }}
                onToggle={() => {
                  onGroupMenuAction?.(collapsed.has(menuGroup.id) ? "expand" : "collapse");
                  toggle(menuGroup.id);
                }}
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
