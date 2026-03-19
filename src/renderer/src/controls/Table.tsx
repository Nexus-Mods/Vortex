import {
  collapseGroup,
  setAttributeFilter,
  setAttributeSort,
  setAttributeVisible,
  setCollapsedGroups,
  setGroupingAttribute,
} from "../actions/tables";
import type { IActionDefinition } from "../types/IActionDefinition";
import type { IAttributeState } from "../types/IAttributeState";
import type { IExtensibleProps } from "../types/IExtensionProvider";
import type { II18NProps } from "../types/II18NProps";
import type { IRowState, IState, ITableState } from "../types/IState";
import type { ITableAttribute } from "../types/ITableAttribute";
import type { SortDirection } from "../types/SortDirection";
import { ComponentEx, connect, extend, translate } from "./ComponentEx";
import Debouncer from "../util/Debouncer";
import { log } from "../util/log";
import smoothScroll from "../smoothScroll";
import { getSafe, setSafe } from "../util/storeHelper";
import { makeUnique, sanitizeCSSId, truthy } from "../util/util";

import IconBar from "./IconBar";
import GroupingRow, { EMPTY_ID } from "./table/GroupingRow";
import HeaderCell from "./table/HeaderCell";
import { Table, TBody, TD, TH, THead, TR } from "./table/MyTable";
import TableDetail from "./table/TableDetail";
import TableRow from "./table/TableRow";
import ToolbarIcon from "./ToolbarIcon";
import Usage from "./Usage";

import PromiseBB from "bluebird";
import update from "immutability-helper";
import * as _ from "lodash";
import * as React from "react";
import { Button } from "react-bootstrap";
import * as ReactDOM from "react-dom";
import type * as Redux from "redux";
import type { OutputSelector } from "reselect";
import { createSelector } from "reselect";
import { getErrorMessageOrDefault } from "@vortex/shared";

export type ChangeDataHandler = (
  rowId: string,
  attributeId: string,
  newValue: any,
) => void;

export interface ITableRowAction extends IActionDefinition {
  singleRowAction?: boolean;
  multiRowAction?: boolean;
  hotKey?: { code: number; shift?: boolean; alt?: boolean; ctrl?: boolean };
  subMenus?: ITableRowAction[];
}

export interface IBaseProps {
  tableId: string;
  data: { [rowId: string]: any };
  // cheap-ass way to force the table to refresh its data cache. This will only affect
  // 'volatile' fields as normal data fields would prompt a table refresh anyway
  dataId?: number;
  actions: ITableRowAction[];
  columnBlacklist?: string[];
  detailsTitle?: string;
  multiSelect?: boolean;
  defaultSort?: string;
  showHeader?: boolean;
  showDetails?: boolean;
  hasActions?: boolean;
  onChangeSelection?: (ids: string[]) => void;
}

interface IConnectedProps {
  attributeState?: { [id: string]: IAttributeState };
  language: string;
  filter: { [id: string]: any };
  groupBy: string;
  collapsedGroups: string[];
}

interface IActionProps {
  onSetAttributeVisible: (
    tableId: string,
    attributeId: string,
    visible: boolean,
  ) => void;
  onSetAttributeSort: (
    tableId: string,
    attributeId: string,
    direction: SortDirection,
  ) => void;
  onSetAttributeFilter: (
    tableId: string,
    attributeId: string,
    filter: any,
  ) => void;
  onSetGroupingAttribute: (tableId: string, attributeId: string) => void;
  onCollapseGroup: (
    tableId: string,
    groupId: string,
    collapse: boolean,
  ) => void;
  onSetCollapsedGroups: (tableId: string, groupOptions: string[]) => void;
}

interface IExtensionProps {
  objects: ITableAttribute[];
}

export interface ILookupCalculated {
  [rowId: string]: { [attributeId: string]: any };
}

interface IComponentState {
  lastSelected?: { rowId: string; groupId: string };
  selectionStart?: { rowId: string; groupId: string };
  calculatedValues?: ILookupCalculated;
  rowState: { [id: string]: IRowState };
  sortedRows: string[];
  groupedRows: Array<{
    id: string;
    name: string;
    count: number;
    rows: string[];
  }>;
  detailsOpen: boolean;
  rowIdsDelayed: string[];
  rowVisibility: { [id: string]: boolean };
  singleRowActions: ITableRowAction[];
  multiRowActions: ITableRowAction[];
  columnToggles: ITableRowAction[];
}

type IProps = IBaseProps &
  IConnectedProps &
  IActionProps &
  IExtensionProps &
  II18NProps;

/**
 * a wrapper for the react-bootstrap table adding various features:
 * - desktop-like selection/multi-selection
 * - sorting
 * - toggleable columns
 * - a detail-pane that gives additional detail on the (last) selected row
 */
class SuperTable extends ComponentEx<IProps, IComponentState> {
  private static SCROLL_DURATION = 200;
  // delay certain actions (like hiding offscreen items) until after scrolling ends.
  // this improves scroll smoothness at the expense of memory
  private static SCROLL_DEBOUNCE = 5000;

  private mVisibleAttributes: ITableAttribute[];
  private mVisibleDetails: ITableAttribute[];
  private mVisibleInlines: ITableAttribute[];

  private mPinnedRef: HTMLElement;
  private mScrollRef: HTMLElement;
  private mHeaderRef: HTMLElement;
  private mRowRefs: { [id: string]: HTMLElement } = {};
  private mLastSelectOnly: number = 0;
  private mLastDetailIds: string[] = [];
  private mDetailTimer: NodeJS.Timeout = null;
  private mLastUpdateState: IProps = undefined;
  private mNextUpdateState: IProps = undefined;
  private mUpdateInProgress: boolean = false;
  private mNextState: IComponentState = undefined;
  private mNextVisibility: { [id: string]: boolean } = {};
  private mDelayedVisibility: { [id: string]: boolean } = {};
  private mDelayedVisibilityTimer: NodeJS.Timeout;
  private mProxyHeaderRef: HTMLElement;
  private mVisibleHeaderRef: HTMLElement;
  private mHeaderUpdateDebouncer: Debouncer;
  private mUpdateCalculatedDebouncer: Debouncer;
  private mLastScroll: number;
  private mWillSetVisibility: boolean = false;
  private mMounted: boolean = false;
  private mNoShrinkColumns: { [attributeId: string]: HeaderCell } = {};
  private mDefaultFilterRef: HTMLElement = null;
  private mLastScrollLeft: number = 0;
  private mLastOnTop: boolean = true;

  constructor(props: IProps) {
    super(props);
    this.mNextState = this.state = {
      lastSelected: undefined,
      calculatedValues: undefined,
      rowState: {},
      sortedRows: undefined,
      groupedRows: undefined,
      detailsOpen: false,
      rowIdsDelayed: [],
      rowVisibility: {},
      singleRowActions: this.singleRowActions(props),
      multiRowActions: this.multiRowActions(props),
      columnToggles: this.columnToggles(props),
    };
    const { table, detail, inline } = this.visibleAttributes(
      props.objects,
      props.attributeState,
    );
    this.mVisibleAttributes = table;
    this.mVisibleDetails = detail;
    this.mVisibleInlines = inline;
    this.updateCalculatedValues(props).then((didRun) => {
      if (didRun) {
        this.refreshSorted(this.mNextUpdateState);
        this.updateSelection(this.mNextUpdateState);
      }
      return null;
    });

    this.mHeaderUpdateDebouncer = new Debouncer(
      () => {
        this.updateColumnWidth();
        return PromiseBB.resolve();
      },
      200,
      false,
    );

    this.mUpdateCalculatedDebouncer = new Debouncer(
      () => {
        return this.updateCalculatedValues(this.props).then(
          (changedColumns) => {
            this.refreshSorted(this.mNextUpdateState);
            this.updateSelection(this.mNextUpdateState);
            return null;
          },
        );
      },
      200,
      true,
    );
  }

  public componentDidMount() {
    this.updateSelection(this.props);
    const { api } = this.context;
    api.events.on(this.props.tableId + "-scroll-to", this.scrollTo);
    api.events.on(this.props.tableId + "-select-item", this.selectItem);
    this.props.objects.forEach((object) => {
      if (object.externalData !== undefined) {
        object.externalData(() => {
          this.invalidate(object.id);
        });
      }
    });
    this.mMounted = true;
    window.addEventListener("resize", this.onResize);
  }

  public componentWillUnmount() {
    this.context.api.events.removeAllListeners(
      this.props.tableId + "-scroll-to",
    );
    window.removeEventListener("resize", this.onResize);
    this.mMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (
      newProps.attributeState !== this.props.attributeState ||
      newProps.objects !== this.props.objects
    ) {
      const { attributeState, objects } = newProps;

      const { table, detail, inline } = this.visibleAttributes(
        objects,
        attributeState,
      );
      this.mVisibleAttributes = table;
      this.mVisibleDetails = detail;
      this.mVisibleInlines = inline;

      if (
        Object.keys(newProps.attributeState).find(
          (id) =>
            this.props.attributeState[id] === undefined ||
            this.props.attributeState[id].enabled !==
              newProps.attributeState[id].enabled,
        )
      ) {
        const columnToggles = this.columnToggles(newProps);
        this.updateState(
          update(this.mNextState, {
            columnToggles: { $set: columnToggles },
          }),
        );
      }
    }

    if (newProps.actions !== this.props.actions) {
      this.updateState(
        update(this.mNextState, {
          singleRowActions: { $set: this.singleRowActions(newProps) },
          multiRowActions: { $set: this.multiRowActions(newProps) },
        }),
      );
    }

    if (newProps.data !== this.props.data) {
      Object.keys(this.mRowRefs).forEach((key) => {
        if (newProps.data[key] === undefined) {
          delete this.mRowRefs[key];
          if (
            this.state.lastSelected !== undefined &&
            this.state.lastSelected.rowId === key
          ) {
            this.updateState(
              update(this.mNextState, { lastSelected: { $set: undefined } }),
            );
          }
        }
      });
    }

    if (
      newProps.data !== this.props.data ||
      newProps.dataId !== this.props.dataId ||
      newProps.objects !== this.props.objects
    ) {
      this.mUpdateCalculatedDebouncer.schedule();
    } else if (
      newProps.attributeState !== this.props.attributeState ||
      newProps.language !== this.props.language ||
      newProps.filter !== this.props.filter
    ) {
      this.refreshSorted(newProps);
    } else if (
      newProps.groupBy !== this.props.groupBy ||
      newProps.collapsedGroups !== this.props.collapsedGroups
    ) {
      this.updateState(
        update(this.mNextState, {
          groupedRows: {
            $set: this.groupedRows(newProps, this.state.sortedRows),
          },
        }),
      );
    }
  }

  public componentDidUpdate() {
    this.mHeaderUpdateDebouncer.schedule();
  }

  public shouldComponentUpdate(newProps: IProps, newState: IComponentState) {
    return (
      newState !== this.state ||
      newProps.dataId !== this.props.dataId ||
      newProps.tableId !== this.props.tableId ||
      newProps.actions !== this.props.actions ||
      newProps.attributeState !== this.props.attributeState ||
      newProps.filter !== this.props.filter ||
      newProps.defaultSort !== this.props.defaultSort ||
      newProps.showHeader !== this.props.showHeader ||
      newProps.detailsTitle !== this.props.detailsTitle ||
      newProps.showDetails !== this.props.showDetails ||
      newProps.groupBy !== this.props.groupBy ||
      newProps.collapsedGroups !== this.props.collapsedGroups
    );
  }

  public render(): JSX.Element {
    const { showHeader, showDetails, tableId } = this.props;
    const { detailsOpen } = this.state;

    const openClass = detailsOpen ? "open" : "closed";

    const containerClasses = ["table-container"];
    if (showDetails) {
      containerClasses.push("has-details");
    }

    return (
      <div id={`table-${tableId}`} className={containerClasses.join(" ")}>
        <div className="table-container-inner">
          <div
            className="table-main-pane"
            ref={this.mainPaneRef}
            tabIndex={0}
            onKeyDown={this.handleKeyDown}
          >
            <Table hover>
              {showHeader === false ? null : this.renderHeader(true)}
              {this.renderBody()}
            </Table>
            {this.props.children}
          </div>
          {this.renderFooter()}
        </div>
        {showHeader === false ? null : (
          <div className="table-header-pane" ref={this.mainHeaderRef}>
            <Table hover>{this.renderHeader(false)}</Table>
          </div>
        )}
        {showDetails === false ? null : (
          <div className={`table-details-pane ${openClass}`}>
            {this.renderDetails()}
          </div>
        )}
      </div>
    );
  }

  private renderHeader(proxy: boolean): JSX.Element {
    const { t, data, hasActions } = this.props;
    const { sortedRows } = this.state;

    const filteredLength =
      sortedRows !== undefined ? sortedRows.length : undefined;
    const totalLength = Object.keys(data).length;

    const actionHeader = this.renderTableActions(hasActions !== false);
    const filterActive =
      filteredLength !== undefined && filteredLength < totalLength;

    return (
      <THead className="table-header">
        <TR domRef={proxy ? this.setProxyHeaderRef : this.setVisibleHeaderRef}>
          {this.mVisibleAttributes.map((attribute) =>
            this.renderHeaderField(attribute, proxy),
          )}
          {actionHeader}
        </TR>
        {filterActive ? (
          <TR className="table-pinned" domRef={this.setPinnedRef}>
            <TD colSpan={this.mVisibleAttributes.length + 1}>
              {t(
                "This table is filtered, showing {{shown}}/{{hidden}} items.",
                { replace: { shown: filteredLength, hidden: totalLength } },
              )}
              <Button onClick={this.clearFilters}>
                {t("Clear all filters")}
              </Button>
            </TD>
          </TR>
        ) : null}
      </THead>
    );
  }

  private renderFooter(): JSX.Element {
    const { t, tableId } = this.props;
    const { multiRowActions, rowState } = this.state;

    const selected = Object.keys(rowState).filter(
      (key) => rowState[key].selected,
    );

    if (!this.useMultiSelect()) {
      return null;
    }

    if (selected.length < 2) {
      return (
        <Usage infoId="table-multiselect">
          {t(
            "Did you know? You can select multiple items using ctrl+click or shift+click or " +
              "select everything using ctrl+a and then do things with all selected items at once.",
          )}
        </Usage>
      );
    }

    // the footer itself (.table-footer) is absolutely positioned so it fills out a surrounding
    // panel. To ensure the table body isn't overlapped by the footer, insert a placeholder
    // that needs to be the same size as the footer itself (see css)
    return (
      <div className="table-footer-placeholder">
        <div className="table-footer">
          <IconBar
            t={t}
            className="menubar"
            group={`${tableId}-multirow-actions`}
            groupByIcon={false}
            instanceId={selected}
            staticElements={multiRowActions}
          />

          <div className="menubar">
            <p>{t("{{ count }} item selected", { count: selected.length })}</p>
            <ToolbarIcon
              key="btn-deselect"
              icon="deselect"
              text={t("Deselect All")}
              onClick={this.deselectAll}
            />
          </div>
        </div>
      </div>
    );
  }

  private renderBody = () => {
    const { t, attributeState, data } = this.props;
    const { calculatedValues, groupedRows, sortedRows } = this.state;

    if (
      data === undefined ||
      calculatedValues === undefined ||
      sortedRows === undefined
    ) {
      return <TBody />;
    }

    const sortAttribute: ITableAttribute = this.mVisibleAttributes.find(
      (attribute) => this.isSortColumn(attributeState[attribute.id]),
    );

    if (groupedRows !== undefined) {
      return (
        <TBody>
          {groupedRows.map((group) => {
            const expanded = group.rows !== null;
            const rows = group.rows || [];
            return [
              <GroupingRow
                t={t}
                key={group.id || "__empty"}
                groupId={group.id}
                groupName={group.name}
                expanded={expanded}
                count={group.count}
                width={this.mVisibleAttributes.length + 1}
                onToggle={this.toggleGroup}
                onExpandAll={this.expandAll}
                onCollapseAll={this.collapseAll}
              />,
              ...rows.map((rowId) =>
                this.renderRow(rowId, sortAttribute, group.id),
              ),
            ];
          })}
        </TBody>
      );
    } else {
      return (
        <TBody>
          {sortedRows.map((row, idx) => this.renderRow(row, sortAttribute))}
        </TBody>
      );
    }
  };

  private toggleGroup = (groupName: string, expand: boolean) => {
    const { onCollapseGroup, tableId } = this.props;

    onCollapseGroup(tableId, groupName, !expand);
  };

  private expandAll = () => {
    const { onSetCollapsedGroups, tableId } = this.props;
    onSetCollapsedGroups(tableId, []);
  };

  private collapseAll = () => {
    const { groupBy, onSetCollapsedGroups, tableId } = this.props;
    const { calculatedValues, sortedRows } = this.state;

    const groupOptions = makeUnique(
      sortedRows.map((rowId) => calculatedValues[rowId][groupBy]),
    );
    onSetCollapsedGroups(tableId, groupOptions);
  };

  private scrollTo = (id: string, mayRetry?: boolean) => {
    try {
      const node = ReactDOM.findDOMNode(this.mRowRefs[id]) as HTMLElement;
      if (node !== null) {
        this.scrollToItem(node, false);
      } else if (mayRetry !== false) {
        setTimeout(() => {
          this.scrollTo(id, false);
        }, 2000);
      } else {
        log("warn", "node not found", id);
      }
    } catch (err) {
      if (mayRetry !== false) {
        setTimeout(() => {
          this.scrollTo(id, false);
        }, 2000);
      } else {
        log("warn", "failed to scroll to item", {
          id,
          tableId: this.props.tableId,
          error: getErrorMessageOrDefault(err),
        });
      }
    }
  };

  private selectItem = (id: string, openDetails: boolean) => {
    this.scrollTo(id);
    this.setGroup(undefined);
    this.selectOnly(id, undefined, false);
    this.updateState(
      update(this.mNextState, {
        detailsOpen: { $set: openDetails },
      }),
      this.onRowStateChanged,
    );
  };

  private getGroupOptions(
    props: IProps,
    sortedRows: string[],
    sortAttribute: ITableAttribute,
    groupAttribute: ITableAttribute,
    valFunc: (key: string) => any,
  ) {
    const { attributeState, data } = props;

    let arrays: boolean = false;

    let compare: (lhs: any, rhs: any) => number;

    const groupOptions = makeUnique(
      sortedRows.reduce((prev, rowId) => {
        if (data[rowId] === undefined) {
          return prev;
        }
        const value = valFunc(rowId);
        if (Array.isArray(value)) {
          arrays = true;
          prev.push(...value);
        } else {
          prev.push(value);
        }
        return prev;
      }, []),
    ).sort((lhs: any, rhs: any) => {
      if (compare === undefined) {
        const desc =
          sortAttribute !== undefined &&
          sortAttribute.id === groupAttribute.id &&
          attributeState[sortAttribute.id]?.sortDirection === "desc";

        if (typeof lhs === "number") {
          compare = desc ? (l, r) => r - l : (l, r) => l - r;
        } else {
          compare = desc
            ? (l, r) =>
                r
                  .toString()
                  .toLowerCase()
                  .localeCompare(l.toString().toLowerCase())
            : (l, r) =>
                l
                  .toString()
                  .toLowerCase()
                  .localeCompare(r.toString().toLowerCase());
        }
      }

      return compare(lhs, rhs);
    });
    if (arrays) {
      groupOptions.push(EMPTY_ID);
    }
    return groupOptions;
  }

  private invalidate(columnId: string) {
    this.updateCalculatedValues(this.props, columnId);
  }

  private toggleDetails = () => {
    const { detailsOpen } = this.state;
    this.updateState(
      update(this.mNextState, { detailsOpen: { $set: !detailsOpen } }),
    );
  };

  private setRowState(rowIds: string[]) {
    const { data } = this.props;
    const filteredRowIds = rowIds.filter(
      (id) =>
        this.state.calculatedValues[id] !== undefined && data[id] !== undefined,
    );
    this.updateState(
      update(this.mNextState, { rowIdsDelayed: { $set: filteredRowIds } }),
    );
    this.mDetailTimer = null;
  }

  private updateDetailIds(rowIds: string[]) {
    if (_.isEqual(this.mLastDetailIds, rowIds)) {
      return;
    }
    this.mLastDetailIds = rowIds;

    if (this.mDetailTimer !== null) {
      clearTimeout(this.mDetailTimer);
    }
    this.mDetailTimer = setTimeout(() => this.setRowState(rowIds), 200);
  }

  private renderDetails = () => {
    const { t, data, detailsTitle, language, objects } = this.props;
    const { calculatedValues, detailsOpen, rowIdsDelayed } = this.state;

    if (
      rowIdsDelayed === undefined ||
      rowIdsDelayed.length === 0 ||
      calculatedValues === undefined ||
      data === undefined
    ) {
      return null;
    }

    return (
      <TableDetail
        t={t}
        rowIds={rowIdsDelayed}
        rowData={calculatedValues}
        rawData={data}
        attributes={this.mVisibleDetails}
        language={language}
        show={detailsOpen}
        title={detailsTitle}
        onToggleShow={this.toggleDetails}
      />
    );
  };

  private columnToggles(props: IProps): ITableRowAction[] {
    const { t, columnBlacklist, objects } = props;

    const result: ITableRowAction[] = [];

    const blacklist: Set<string> = new Set(columnBlacklist || []);

    const { columns, inlines, disabled } = objects.reduce(
      (prev, attr) => {
        if (attr.isToggleable && !blacklist.has(attr.id)) {
          const visible = attr.condition?.() ?? true;
          const attributeState = this.getAttributeState(
            attr,
            props.attributeState,
          );
          prev[
            attr.placement === "inline"
              ? "inlines"
              : visible
                ? "columns"
                : "disabled"
          ].push({
            icon: attributeState.enabled
              ? "checkbox-checked"
              : "checkbox-unchecked",
            title: attr.name,
            action: (arg) =>
              this.setAttributeVisible(attr.id, !attributeState.enabled),
          });
        }
        return prev;
      },
      { columns: [], inlines: [], disabled: [] },
    );

    if (columns.length > 0) {
      result.push(
        {
          icon: null,
          title: "Toggle Columns",
        },
        ...columns,
      );
    }
    if (inlines.length > 0) {
      result.push(
        {
          icon: null,
          title: "Toggle Inlines",
        },
        ...inlines,
      );
    }
    /* currently not showing disabled columns at all, that's probably the more
       intuitive solution
    if (disabled.length > 0) {
      result.push({
        icon: null,
        title: t('Toggle Disabled Columns'),
      }, ...disabled);
    }
    */

    return result.map((res, idx) => ({ ...res, position: idx }));
  }

  private renderTableActions(hasActions: boolean): JSX.Element {
    const { t, tableId } = this.props;
    const { columnToggles } = this.state;

    return (
      <TH className={`table-${tableId} header-action`}>
        <div>
          {hasActions ? (
            <div className="header-action-label">{t("Actions")}</div>
          ) : null}
          {columnToggles.length > 0 ? (
            <IconBar
              id={`${tableId}-tableactions`}
              group={`${tableId}-action-icons-multi`}
              className="table-actions"
              staticElements={columnToggles}
              collapse="force"
              icon="settings"
              t={t}
            />
          ) : null}
        </div>
      </TH>
    );
  }

  private isSortColumn(attributeState: IAttributeState) {
    return (
      attributeState !== undefined &&
      attributeState.sortDirection !== undefined &&
      attributeState.sortDirection !== "none"
    );
  }

  private renderRow(
    rowId: string,
    sortAttribute: ITableAttribute,
    groupId?: string,
  ): JSX.Element {
    const { t, attributeState, data, language, hasActions, objects, tableId } =
      this.props;
    const { calculatedValues, rowState, rowVisibility, singleRowActions } =
      this.state;

    if (calculatedValues[rowId] === undefined || data[rowId] === undefined) {
      return null;
    }

    const attributes = this.mVisibleAttributes;

    const extraClasses = this.props.objects
      .map((attr) =>
        attr.cssClass?.(
          data[rowId],
          this.getAttributeState(attr, attributeState).enabled,
        ),
      )
      .filter((cls) => truthy(cls));

    extraClasses.push(sanitizeCSSId(rowId));

    const tableRowId = sanitizeCSSId(rowId + "_" + (groupId || ""));

    return (
      <TableRow
        t={t}
        tableId={tableId}
        id={tableRowId}
        rowClasses={extraClasses}
        key={tableRowId}
        data={calculatedValues[rowId]}
        group={groupId}
        rawData={data[rowId]}
        attributes={attributes}
        inlines={this.mVisibleInlines}
        sortAttribute={
          sortAttribute !== undefined ? sortAttribute.id : undefined
        }
        actions={singleRowActions}
        hasActions={hasActions !== undefined ? hasActions : true}
        language={language}
        onClick={this.selectRow}
        selected={getSafe(rowState, [rowId, "selected"], false)}
        highlighted={getSafe(rowState, [rowId, "highlighted"], false)}
        domRef={this.setRowRef}
        container={this.mScrollRef}
        visible={rowVisibility[tableRowId] === true}
        grouped={groupId !== undefined}
        onSetVisible={this.setRowVisible}
        onHighlight={this.setRowHighlight}
      />
    );
  }

  private filterSet(filt: any) {
    return truthy(filt) && (!Array.isArray(filt) || filt.length !== 0);
  }

  private renderHeaderField = (
    attribute: ITableAttribute,
    proxy: boolean,
  ): JSX.Element => {
    const { t, filter, groupBy } = this.props;

    const attributeState = this.getAttributeState(attribute);

    const filt =
      attribute.filter !== undefined && filter !== undefined
        ? (filter[attribute.id] ?? null)
        : undefined;

    if (attributeState.enabled) {
      const classes = [`header-${attribute.id}`];
      if (
        this.filterSet(filt) &&
        (attribute.filter.isEmpty === undefined ||
          !attribute.filter.isEmpty(filt))
      ) {
        classes.push("table-filter-column");
      }
      if (this.isSortColumn(attributeState)) {
        classes.push("table-sort-column");
      }
      return (
        <HeaderCell
          className={classes.join(" ")}
          key={attribute.id}
          attribute={attribute}
          state={attributeState}
          doFilter={true}
          doGroup={attribute.id === groupBy}
          onSetSortDirection={this.setSortDirection}
          onSetGroup={this.setGroup}
          onSetFilter={this.setFilter}
          ref={proxy ? this.setHeaderCellRef : undefined}
          t={t}
        >
          {attribute.filter !== undefined ? (
            <attribute.filter.component
              filter={filt}
              attributeId={attribute.id}
              domRef={
                attribute.isDefaultFilter ? this.setDefaultFilterRef : undefined
              }
              t={t}
              onSetFilter={this.setFilter}
            />
          ) : null}
        </HeaderCell>
      );
    } else {
      return null;
    }
  };

  private setDefaultFilterRef = (ref: HTMLElement) => {
    this.mDefaultFilterRef = ref;
  };

  private setHeaderCellRef = (ref: HeaderCell) => {
    if (ref !== null) {
      if (ref.props.attribute.noShrink === true) {
        this.mNoShrinkColumns[ref.props.attribute.id] = ref;
      }
    }
  };

  private handleKeyDown = (evt: React.KeyboardEvent<any>) => {
    const { lastSelected, selectionStart, sortedRows } = this.state;

    try {
      if (evt.target !== this.mScrollRef) {
        return;
      }

      if (evt.key === "f" && evt.ctrlKey) {
        if (this.mDefaultFilterRef !== null) {
          this.mDefaultFilterRef.focus();
        }
        return;
      }

      if (this.useMultiSelect()) {
        if (evt.key === "a" && evt.ctrlKey) {
          this.selectAll();
          return;
        }

        if (evt.shiftKey && selectionStart === undefined) {
          const selection =
            lastSelected !== undefined
              ? { rowId: lastSelected.rowId, groupId: lastSelected.groupId }
              : undefined;

          this.updateState(
            update(this.mNextState, {
              selectionStart: { $set: selection },
            }),
          );
        } else if (!evt.shiftKey && selectionStart !== undefined) {
          this.updateState(
            update(this.mNextState, {
              selectionStart: { $set: undefined },
            }),
          );
        }
      }

      // TODO: this calculation of the number of lines visible in the table is only
      // accurate under the assumption all lines have the same height
      let visibleLineCount = 0;
      if (
        lastSelected !== undefined &&
        this.mRowRefs[lastSelected.rowId] !== undefined
      ) {
        // the previously selected row might no longer be visible, which would cause
        // an exception when trying to find the associated dom node
        const lastIdx = sortedRows.indexOf(lastSelected.rowId);
        if (lastIdx !== -1) {
          const selectedNode = ReactDOM.findDOMNode(
            this.mRowRefs[lastSelected.rowId],
          ) as Element;
          visibleLineCount =
            this.mScrollRef.clientHeight / selectedNode.clientHeight;
          // account for the header. quite inaccurate.
          visibleLineCount -= 2;
        }
      }

      let offset = 0;
      switch (evt.keyCode) {
        case 32: {
          evt.preventDefault();
          this.toggleDetails();
          break;
        }
        case 33:
          offset = Math.round(visibleLineCount * -0.5);
          break;
        case 34:
          offset = Math.round(visibleLineCount * 0.5);
          break;
        case 38:
          offset = -1;
          break;
        case 40:
          offset = 1;
          break;
      }
      if (offset !== 0) {
        evt.preventDefault();
        const groupId =
          evt.currentTarget.getAttribute("data-group") || undefined;
        const newItem = this.selectRelative(offset, groupId, evt.shiftKey);
        if (this.mRowRefs[newItem] !== undefined && this.mMounted) {
          this.scrollToItem(
            ReactDOM.findDOMNode(this.mRowRefs[newItem]) as HTMLElement,
            Math.abs(offset) > 1,
          );
        }
      } else {
        const action = this.props.actions.find((iter) =>
          this.matchHotKey(
            iter,
            evt.keyCode,
            evt.shiftKey,
            evt.altKey,
            evt.ctrlKey,
          ),
        );
        if (action !== undefined) {
          evt.preventDefault();
          const { rowState } = this.state;
          action.action(
            Object.keys(rowState).filter((id) => rowState[id].selected),
          );
        }
      }
    } catch (err) {
      log("warn", "failed to handle keydown event", err);
    }
  };

  private matchHotKey(
    action: ITableRowAction,
    code: number,
    shift: boolean,
    alt: boolean,
    ctrl: boolean,
  ): boolean {
    return (
      action.hotKey !== undefined &&
      action.hotKey.code === code &&
      (action.hotKey.shift || shift === false) &&
      (action.hotKey.alt || alt === false) &&
      (action.hotKey.ctrl || ctrl === false)
    );
  }

  private refreshSorted(props: IProps) {
    const { data, language } = props;
    if (this.state.calculatedValues === undefined) {
      return;
    }
    const filtered: { [key: string]: any } = this.filteredRows(
      props,
      this.mVisibleAttributes,
      data,
    );

    const attrState = this.getAttributeStates(props);

    const sortedRows = this.sortedRows(
      attrState,
      this.mVisibleAttributes,
      filtered,
      language,
    );
    const groupedRows = this.groupedRows(props, sortedRows);

    this.updateState(
      update(this.mNextState, {
        sortedRows: { $set: sortedRows },
        groupedRows: { $set: groupedRows },
      }),
    );
  }

  private getAttributeStates(props: IProps): { [id: string]: IAttributeState } {
    return Object.keys(props.attributeState ?? {}).length > 0 ||
      this.mVisibleAttributes === undefined
      ? props.attributeState
      : this.mVisibleAttributes.reduce((prev, attribute) => {
          if (attribute.isDefaultSort === true) {
            prev[attribute.id] = { sortDirection: "asc" };
          } else if (attribute.isDefaultSort === "desc") {
            prev[attribute.id] = { sortDirection: "desc" };
          }
          return prev;
        }, {});
  }

  private singleRowActions(props: IProps) {
    return props.actions.filter((action) => action.singleRowAction ?? true);
  }

  private multiRowActions(props: IProps) {
    return props.actions.filter((action) => action.multiRowAction ?? true);
  }

  private selectRelative = (
    delta: number,
    groupId: string,
    shiftHeld: boolean,
  ): string => {
    const { groupBy } = this.props;
    const { groupedRows, lastSelected, selectionStart, sortedRows } =
      this.state;
    if (lastSelected === undefined || sortedRows === undefined) {
      return;
    }

    let groupSortedRows: string[];
    if (groupBy !== undefined) {
      groupSortedRows = groupedRows.reduce((prev, group) => {
        prev.push(...(group.rows || []));
        return prev;
      }, []);
    } else {
      groupSortedRows = sortedRows;
    }

    let idx = groupSortedRows.indexOf(lastSelected.rowId);
    const oldIdx = idx;
    idx = Math.min(Math.max(idx + delta, 0), groupSortedRows.length - 1);

    const newSelection = groupSortedRows[idx];

    if (oldIdx === idx) {
      return newSelection;
    }

    this.selectOnly(newSelection, groupId, false);
    if (shiftHeld) {
      this.selectTo(selectionStart.rowId, selectionStart.groupId);
    }
    return newSelection;
  };

  private setProxyHeaderRef = (ref) => {
    this.mProxyHeaderRef = ref;
    this.mHeaderUpdateDebouncer.schedule();
  };

  private setVisibleHeaderRef = (ref) => {
    this.mVisibleHeaderRef = ref;
    this.mHeaderUpdateDebouncer.schedule();
  };

  private mLastHeaderHeight: number = 0;

  private updateColumnWidth() {
    if (!truthy(this.mProxyHeaderRef) || !truthy(this.mVisibleHeaderRef)) {
      return;
    }

    this.mProxyHeaderRef.childNodes.forEach((node, index) => {
      (
        this.mVisibleHeaderRef.childNodes.item(index) as HTMLElement
      ).style.minWidth = (
        this.mVisibleHeaderRef.childNodes.item(index) as HTMLElement
      ).style.maxWidth = `${(node as HTMLElement).clientWidth}px`;
    });

    const height = this.mVisibleHeaderRef.clientHeight;
    if (height !== this.mLastHeaderHeight) {
      this.mScrollRef.style["marginTop"] = `${height}px`;
      this.mLastHeaderHeight = height;
    }
  }

  private setPinnedRef = (ref) => {
    this.mPinnedRef = ref;
  };

  private setRowRef = (ref: any) => {
    if (ref !== null) {
      this.mRowRefs[ref.props["data-rowid"]] = ref;
    }
  };

  private setRowVisible = (rowId: string, visible: boolean) => {
    // turn rows visible asap, turning them invisible can be done when scrolling ends
    // Important: This was intended as a performance optimisation but it also fixed
    //   a problem where drag&drop connectors between rows far apart didn't work because
    //   the source was hidden before while dragging.
    if (visible || this.mDelayedVisibilityTimer === undefined) {
      this.mNextVisibility[rowId] = visible;
      this.mDelayedVisibility[rowId] = visible;
      // it's possible that a previous visibility change hadn't even been
      // rendered yet, in this case we don't have to trigger an update
      if (visible !== this.state.rowVisibility[rowId]) {
        this.triggerUpdateVisibility();
      }
    } else {
      this.mDelayedVisibility[rowId] = visible;
    }
  };

  private triggerUpdateVisibility() {
    if (!this.mWillSetVisibility) {
      this.mWillSetVisibility = true;
      window.requestAnimationFrame(() => {
        this.mWillSetVisibility = false;
        this.updateState(
          setSafe(this.mNextState, ["rowVisibility"], {
            ...this.mNextVisibility,
          }),
        );
      });
    }
  }

  private postScroll() {
    if (Date.now() - this.mLastScroll < SuperTable.SCROLL_DEBOUNCE) {
      this.mDelayedVisibilityTimer = setTimeout(
        () => this.postScroll(),
        SuperTable.SCROLL_DEBOUNCE + 100,
      );
    } else {
      this.mDelayedVisibilityTimer = undefined;
      this.mNextVisibility = { ...this.mDelayedVisibility };
      this.triggerUpdateVisibility();
    }
  }

  private setRowHighlight = (rowId: string, highlighted: boolean) => {
    this.updateState(
      setSafe(this.mNextState, ["rowState", rowId, "highlighted"], highlighted),
    );
  };

  private scrollToItem = (
    item: HTMLElement,
    smooth: boolean,
    iterations: number = 3,
  ) => {
    const height = this.mScrollRef.offsetHeight;
    const offset = height / 5;
    const topLimit = this.mScrollRef.scrollTop + offset;
    const bottomLimit =
      this.mScrollRef.scrollTop + this.mScrollRef.clientHeight - offset;
    const itemBottom = item.offsetTop + item.offsetHeight;

    let targetPos: number;
    if (item.offsetTop < topLimit) {
      targetPos = Math.max(item.offsetTop - offset, 0);
    } else if (itemBottom > bottomLimit) {
      targetPos = itemBottom - this.mScrollRef.clientHeight + offset;
    }
    if (targetPos !== undefined && targetPos !== this.mScrollRef.scrollTop) {
      if (smooth) {
        smoothScroll(
          this.mScrollRef,
          targetPos,
          SuperTable.SCROLL_DURATION,
        ).then((cont: boolean) =>
          cont && iterations > 0
            ? this.scrollToItem(item, false, iterations - 1)
            : PromiseBB.resolve(),
        );
      } else {
        this.mScrollRef.scrollTop = targetPos;

        if (iterations > 0) {
          // workaround: since we're not rendering off-screen rows it's possible for row heights to
          //  change as we scroll and then the offset we calculated might not be in the visible
          //  range after all.
          setTimeout(() => {
            this.scrollToItem(item, smooth, iterations - 1);
          }, 100);
        }
      }
    }
  };

  private onScroll = (event) => {
    this.mLastScroll = Date.now();
    if (this.mDelayedVisibilityTimer === undefined) {
      this.mDelayedVisibilityTimer = setTimeout(
        () => this.postScroll(),
        SuperTable.SCROLL_DEBOUNCE + 100,
      );
    }
    const ele: Element = event.target;

    const atTop = ele.scrollTop === 0;
    if (
      (ele.scrollLeft !== this.mLastScrollLeft && truthy(this.mHeaderRef)) ||
      (atTop !== this.mLastOnTop && truthy(this.mPinnedRef))
    ) {
      this.mLastOnTop = atTop;
      this.mLastScrollLeft = ele.scrollLeft;

      window.requestAnimationFrame(() => {
        if (truthy(this.mPinnedRef)) {
          this.mPinnedRef.className = atTop
            ? "table-pinned"
            : "table-pinned-hidden";
        }
        if (truthy(this.mHeaderRef)) {
          this.mHeaderRef.style.left = `-${ele.scrollLeft}px`;
        }
      });
    }
    Object.keys(this.mNoShrinkColumns).forEach((colId) => {
      this.mNoShrinkColumns[colId].updateWidth();
    });
  };

  private onResize = () => {
    this.mHeaderUpdateDebouncer.schedule();
  };

  private mainPaneRef = (ref: HTMLElement) => {
    if (ref === null) {
      return;
    }

    // not sure if this is necessary, I guess not
    ref.removeEventListener("scroll", this.onScroll);

    // translate the header so that it remains in view during scrolling
    ref.addEventListener("scroll", this.onScroll);
    this.mScrollRef = ref;
  };

  private mainHeaderRef = (ref) => {
    this.mHeaderRef = ref;
  };

  private updateCalculatedValues(
    props: IProps,
    forceUpdateId?: string,
  ): PromiseBB<string[]> {
    this.mNextUpdateState = props;
    if (this.mUpdateInProgress) {
      return PromiseBB.resolve([]);
    }
    this.mUpdateInProgress = true;

    const { t, data, objects } = props;

    // keep track of which columns had data changed so that we can later figure out if
    // sorting needs to be updated
    const changedColumns = new Set<string>();

    const oldState = this.mLastUpdateState || { data: {} };
    let newValues: ILookupCalculated = this.state.calculatedValues || {};

    // recalculate each attribute in each row
    return PromiseBB.map(Object.keys(data), (rowId: string) => {
      const delta: any = {};

      return PromiseBB.map(objects, (attribute: ITableAttribute) => {
        // avoid recalculating if the source data hasn't changed. To support
        // isVolatile we still go through each attribute even if the entire row didn't change
        if (
          !attribute.isVolatile &&
          attribute.id !== forceUpdateId &&
          oldState.data[rowId] === data[rowId]
        ) {
          return PromiseBB.resolve();
        }
        if (attribute.calc === undefined) {
          return PromiseBB.resolve();
        }
        return PromiseBB.resolve(attribute.calc(data[rowId], t))
          .then((newValue) => {
            if (
              !_.isEqual(
                newValue,
                getSafe(newValues, [rowId, attribute.id], undefined),
              )
            ) {
              changedColumns.add(attribute.id);
              delta[attribute.id] = newValue;
            }
            return null;
          })
          .catch((err) => {
            log("error", "failed to calculate attribute value", {
              attribute: attribute.id,
              row: rowId,
              error: getErrorMessageOrDefault(err),
            });
          });
      }).then(() => {
        if (Object.keys(delta).length > 0) {
          delta.__id = rowId;
          if (newValues[rowId] === undefined) {
            newValues[rowId] = delta;
          } else {
            newValues = update(newValues, { [rowId]: { $merge: delta } });
          }
        }
      });
    })
      .then(() =>
        PromiseBB.map(Object.keys(oldState.data), (rowId) => {
          if (data[rowId] === undefined) {
            delete newValues[rowId];
          }
        }),
      )
      .then(
        () =>
          // once everything is recalculated, update the cache
          new PromiseBB<void>((resolve, reject) => {
            this.updateState(
              update(this.mNextState, {
                calculatedValues: { $set: newValues },
              }),
              () => resolve(),
            );
          }),
      )
      .then(() => {
        const { rowState } = this.state;
        return this.updateDetailIds(
          Object.keys(rowState).filter((id) => rowState[id].selected),
        );
      })
      .then(() => {
        this.mUpdateInProgress = false;
        this.mLastUpdateState = props;
        if (this.mNextUpdateState !== this.mLastUpdateState) {
          // another update was queued while this was active
          return this.updateCalculatedValues(this.mNextUpdateState);
        } else {
          return PromiseBB.resolve(Array.from(changedColumns));
        }
      })
      .catch((err) => {
        this.mUpdateInProgress = false;
        return PromiseBB.reject(err);
      });
  }

  private updateSelection(props: IProps) {
    // unselect rows that are no longer in the data
    const changes = {};
    const selected = [];
    Object.keys(this.state.rowState).forEach((rowId) => {
      if (this.state.rowState[rowId].selected) {
        if (props.data[rowId] === undefined) {
          changes[rowId] = { selected: { $set: false } };
        } else {
          selected.push(rowId);
        }
      }
    });
    if (!_.isEqual(this.mNextState.rowState, changes)) {
      this.updateState(
        update(this.mNextState, { rowState: changes }),
        this.onRowStateChanged,
      );
    }
  }

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1 : lhs === rhs ? 0 : 1;
  }

  private filteredRows(
    props: IProps,
    attributes: ITableAttribute[],
    data: { [id: string]: any },
  ) {
    const { filter } = props;
    const { calculatedValues } = this.state;

    if (filter === undefined) {
      return data;
    }

    const result = {};
    Object.keys(calculatedValues)
      .filter((rowId) => {
        // filter out rows which no longer exist
        if (data[rowId] === undefined) {
          return false;
        }
        // return only elements for which we can't find a non-matching filter
        // (in other words: Keep only those items that match all filters)
        return (
          attributes.find((attribute) => {
            if (attribute.filter === undefined) {
              return false;
            }

            const dataId = attribute.filter.dataId || attribute.id;

            // raw can be true, false or a string that specifies an attribute that is
            // different from the one for which the filter is set. The raw value of that
            // attribute is then used for the filter
            const value =
              attribute.filter.raw !== false
                ? attribute.filter.raw === true
                  ? dataId === "$"
                    ? data[rowId]
                    : data[rowId][dataId]
                  : (data[rowId][attribute.filter.raw] || {})[dataId]
                : calculatedValues[rowId][dataId];

            return (
              filter[attribute.id] !== undefined &&
              filter[attribute.id] !== null &&
              !attribute.filter.matches(
                filter[attribute.id],
                value,
                this.context.api.store.getState(),
              )
            );
          }) === undefined
        );
      })
      .forEach((key) => (result[key] = data[key]));
    return result;
  }

  private attributeSortFunction(
    sortAttribute: ITableAttribute,
    calculatedValues: ILookupCalculated,
    data: { [id: string]: any },
    locale: string,
  ) {
    let sortFunction;
    if (sortAttribute.sortFunc !== undefined) {
      sortFunction = (lhsId: string, rhsId: string) =>
        sortAttribute.sortFunc(
          calculatedValues[lhsId][sortAttribute.id],
          calculatedValues[rhsId][sortAttribute.id],
          locale,
        );
    } else if (sortAttribute.sortFuncRaw !== undefined) {
      sortFunction = (lhsId: string, rhsId: string) =>
        sortAttribute.sortFuncRaw(data[lhsId], data[rhsId], locale);
    } else {
      sortFunction = (lhsId: string, rhsId: string) =>
        this.standardSort(
          calculatedValues[lhsId][sortAttribute.id],
          calculatedValues[rhsId][sortAttribute.id],
        );
    }
    return sortFunction;
  }

  private sortedRows(
    attributeState: { [id: string]: IAttributeState },
    attributes: ITableAttribute[],
    data: { [id: string]: any },
    locale: string,
  ): string[] {
    const { calculatedValues } = this.state;

    const sortAttribute: ITableAttribute = attributes.find((attribute) => {
      return (
        attributeState[attribute.id] !== undefined &&
        attributeState[attribute.id].sortDirection !== undefined &&
        attributeState[attribute.id].sortDirection !== "none"
      );
    });

    // return unsorted if no sorting column was selected or if the values
    // haven't been calculated yet
    if (sortAttribute === undefined) {
      return (
        Object.keys(data)
          // catch cases where input data was broken. Code is usually not
          // equipped to deal with undefined row data
          .filter((rowId) => data[rowId] !== undefined)
      );
    }

    const sortFunction = this.attributeSortFunction(
      sortAttribute,
      calculatedValues,
      data,
      locale,
    );

    const descending =
      attributeState[sortAttribute.id].sortDirection === "desc";

    const dataIds = Object.keys(data).filter(
      (key) => calculatedValues[key] !== undefined,
    );

    // comparison function if either value or both is/are undefined
    const undefCompare = (lhsId: string, rhsId: string) =>
      calculatedValues[lhsId][sortAttribute.id] !== undefined
        ? 1
        : calculatedValues[rhsId][sortAttribute.id] !== undefined
          ? -1
          : 0;

    return dataIds.sort((lhsId: string, rhsId: string): number => {
      const res =
        sortAttribute.sortFuncRaw !== undefined ||
        (calculatedValues[lhsId][sortAttribute.id] !== undefined &&
          calculatedValues[rhsId][sortAttribute.id] !== undefined)
          ? sortFunction(lhsId, rhsId)
          : undefCompare(lhsId, rhsId);

      return descending ? res * -1 : res;
    });
  }

  private groupedRows(
    props: IProps,
    sortedRows: string[],
  ): Array<{ id: string; name: string; count: number; rows: string[] }> {
    const { t, attributeState, collapsedGroups, data, groupBy } = props;
    const { calculatedValues } = this.state;

    const groupAttribute = this.mVisibleAttributes.find(
      (attribute) => attribute.id === groupBy,
    );

    if (groupAttribute === undefined) {
      return undefined;
    }

    if (sortedRows === undefined) {
      return [];
    }

    const sortAttribute: ITableAttribute = this.mVisibleAttributes.find(
      (attribute) => this.isSortColumn(attributeState[attribute.id]),
    );

    const valFunc = (rowId: string) =>
      typeof groupAttribute.isGroupable === "function"
        ? groupAttribute.isGroupable(data[rowId], t)
        : calculatedValues[rowId]?.[groupAttribute.id] || "";

    const groupOptions = this.getGroupOptions(
      this.props,
      sortedRows,
      sortAttribute,
      groupAttribute,
      valFunc,
    );

    return groupOptions.reduce((prev, group) => {
      const groupItems = sortedRows.filter((row) => {
        if (data[row] === undefined) {
          return prev;
        }
        const rowVal = valFunc(row);
        if (Array.isArray(rowVal)) {
          if (rowVal.length === 0) {
            return group === EMPTY_ID;
          }
          return rowVal.indexOf(group) !== -1;
        } else {
          return rowVal === group;
        }
      });

      if (groupItems.length !== 0) {
        const expanded = collapsedGroups.indexOf(group || "") === -1;
        const groupName =
          groupAttribute.groupName !== undefined
            ? groupAttribute.groupName(group)
            : group;
        prev.push({
          id: group,
          name: groupName,
          count: groupItems.length,
          rows: expanded ? groupItems : null,
        });
      }

      return prev;
    }, []);
  }

  private setAttributeVisible = (attributeId: string, visible: boolean) => {
    const { onSetAttributeVisible, tableId } = this.props;
    onSetAttributeVisible(tableId, attributeId, visible);
  };

  private getClasses(element: HTMLElement): string {
    // because classname is supposed to be a string but on svg elements
    // it may be SVGAnimatedString
    const classAny: any = element.className;
    return classAny === undefined
      ? ""
      : classAny instanceof SVGAnimatedString
        ? classAny.baseVal
        : element.className;
  }

  private selectRow = (evt: React.MouseEvent<any>) => {
    if (evt.isDefaultPrevented()) {
      return;
    }

    const { selectionStart } = this.state;

    if (!evt.shiftKey && selectionStart !== undefined) {
      this.updateState(
        update(this.mNextState, {
          selectionStart: { $set: undefined },
        }),
      );
    }

    let iter = evt.target as any;
    while (
      iter !== null &&
      iter !== undefined &&
      iter.tagName !== "BUTTON" &&
      this.getClasses(iter).split(" ").indexOf("xtd") === -1
    ) {
      iter = iter.parentNode;
    }

    if (iter !== null && iter.tagName === "BUTTON") {
      // don't handle if the click was on a button
      return;
    }

    const row = evt.currentTarget as HTMLTableRowElement;
    const rowId = row.getAttribute("data-rowid");
    const groupId = row.getAttribute("data-group");

    if (this.useMultiSelect() && evt.ctrlKey) {
      // ctrl-click -> toggle the selected row, leave remaining selection intact
      this.selectToggle(rowId, groupId);
    } else if (this.useMultiSelect() && evt.shiftKey) {
      // shift-click -> select everything between this row and the last one clicked,
      //                deselect everything else
      this.selectTo(rowId, groupId);
    } else {
      // regular click -> select only the clicked row, everything else get deselected
      this.selectOnly(rowId, groupId, true);
    }

    // Focus the table container to enable keyboard shortcuts (CTRL+A, arrow keys, etc.)
    this.mScrollRef?.focus();
  };

  private selectOnly(rowId: string, groupId: string, click: boolean) {
    const rowState = {};
    Object.keys(this.state.rowState).forEach((iterId) => {
      rowState[iterId] = { selected: { $set: false } };
    });
    rowState[rowId] =
      this.state.rowState[rowId] === undefined
        ? { $set: { selected: true } }
        : { selected: { $set: true } };

    const now = Date.now();
    if (
      click &&
      this.state.lastSelected !== undefined &&
      this.state.lastSelected.rowId === rowId &&
      now - this.mLastSelectOnly < 500
    ) {
      this.updateState(
        update(this.mNextState, {
          detailsOpen: { $set: !this.state.detailsOpen },
          rowState,
        }),
        this.onRowStateChanged,
      );
    } else {
      if (click) {
        this.mLastSelectOnly = now;
      }
      this.updateState(
        update(this.mNextState, {
          lastSelected: { $set: { rowId, groupId } },
          rowState,
        }),
        this.onRowStateChanged,
      );
    }
  }

  private selectToggle(rowId: string, groupId: string) {
    const wasSelected = getSafe(
      this.state.rowState,
      [rowId, "selected"],
      undefined,
    );
    if (!wasSelected) {
      const rowState =
        wasSelected === undefined
          ? { $set: { selected: true } }
          : { selected: { $set: !wasSelected } };
      this.updateState(
        update(this.mNextState, {
          lastSelected: { $set: { rowId, groupId } },
          rowState: { [rowId]: rowState },
        }),
        this.onRowStateChanged,
      );
    } else {
      this.updateState(
        update(this.mNextState, {
          rowState: { [rowId]: { selected: { $set: !wasSelected } } },
        }),
        this.onRowStateChanged,
      );
    }
  }

  private onRowStateChanged = () => {
    const { onChangeSelection } = this.props;
    const { rowState } = this.state;
    const selectedIds: string[] = Object.keys(rowState).filter(
      (id) => rowState[id].selected,
    );
    this.updateDetailIds(selectedIds);

    onChangeSelection?.(selectedIds);
  };

  private deselectAll = () => {
    const { rowState } = this.state;

    const newState = {};
    Object.keys(rowState).forEach((key) => {
      if (rowState[key].selected) {
        newState[key] = { selected: { $set: false } };
      }
    });
    this.updateState(
      update(this.mNextState, { rowState: newState }),
      this.onRowStateChanged,
    );
  };

  private selectAll() {
    const { sortedRows, rowState } = this.state;

    const newState = {};
    // first, disable what's currently selected
    Object.keys(rowState).forEach((key) => {
      if (rowState[key].selected) {
        newState[key] = { selected: { $set: false } };
      }
    });

    // then (re-)enable all visible selections
    (sortedRows || []).forEach((key) => {
      newState[key] =
        newState[key] === undefined
          ? { $set: { selected: true } }
          : { selected: { $set: true } };
    });
    this.updateState(
      update(this.mNextState, { rowState: newState }),
      this.onRowStateChanged,
    );
  }

  private selectTo(rowId: string, groupId: string) {
    const { objects } = this.props;
    const { lastSelected, groupedRows, sortedRows } = this.mNextState;

    if (lastSelected === undefined) {
      return;
    }

    let groupBy = this.props.groupBy;
    // if the grouping attribute was provided by an extension it might have become unavailable
    const groupAttribute =
      groupBy !== undefined
        ? objects.find((attribute: ITableAttribute) => attribute.id === groupBy)
        : undefined;

    const groupByState =
      groupAttribute !== undefined
        ? this.getAttributeState(groupAttribute)
        : undefined;

    if (groupBy !== undefined && !groupByState?.enabled) {
      groupBy = undefined;
    }

    let groupSortedRows: Array<{ rowId: string; groupId: string }>;
    if (groupBy !== undefined && groupedRows !== undefined) {
      groupSortedRows = groupedRows.reduce((prev, group) => {
        prev.push(
          ...((group.rows || []).map((rId) => ({
            rowId: rId,
            groupId: group.id,
          })) || []),
        );
        return prev;
      }, []);
    } else {
      groupSortedRows = sortedRows.map((rId) => ({
        rowId: rId,
        groupId: undefined,
      }));
    }

    const selection: Set<string> = new Set([rowId, lastSelected.rowId]);
    let selecting = false;

    groupSortedRows.forEach((iterId) => {
      let isBracket =
        (iterId.rowId === rowId && (!groupBy || iterId.groupId === groupId)) ||
        (iterId.rowId === lastSelected.rowId &&
          (!groupBy || iterId.groupId === lastSelected.groupId));
      if (!selecting && isBracket) {
        selecting = true;
        isBracket =
          rowId === lastSelected.rowId && groupId === lastSelected.groupId;
      }
      if (selecting) {
        selection.add(iterId.rowId);
        if (isBracket) {
          selecting = false;
        }
      }
    });

    const rowState = {};
    groupSortedRows.forEach((iterId) => {
      rowState[iterId.rowId] =
        this.state.rowState[iterId.rowId] === undefined
          ? { $set: { selected: selection.has(iterId.rowId) } }
          : { selected: { $set: selection.has(iterId.rowId) } };
    });
    this.updateState(
      update(this.mNextState, { rowState }),
      this.onRowStateChanged,
    );
  }

  private visibleAttributes(
    attributes: ITableAttribute[],
    attributeStates: { [id: string]: IAttributeState },
  ): {
    table: ITableAttribute[];
    detail: ITableAttribute[];
    inline: ITableAttribute[];
  } {
    const filtered = attributes
      .filter(
        (attribute) =>
          (attribute.condition === undefined || attribute.condition()) &&
          !(this.props.columnBlacklist || []).includes(attribute.id),
      )
      .sort((lhs, rhs) => (lhs.position ?? 100) - (rhs.position ?? 100));
    const enabled = filtered.filter(
      (attribute) => this.getAttributeState(attribute, attributeStates).enabled,
    );

    const attributeSort = (lhs: ITableAttribute, rhs: ITableAttribute) =>
      (lhs.position || 100) - (rhs.position || 100);

    return {
      table: enabled
        .filter((attribute) => ["table", "both"].includes(attribute.placement))
        .sort(attributeSort),
      detail: filtered
        .filter((attribute) => ["detail", "both"].includes(attribute.placement))
        .sort(attributeSort),
      inline: enabled
        .filter((attribute) => attribute.placement === "inline")
        .sort(attributeSort),
    };
  }

  private getAttributeState(
    attribute: ITableAttribute,
    attributeStatesIn?: { [id: string]: IAttributeState },
  ) {
    const attributeStates =
      attributeStatesIn || this.getAttributeStates(this.props) || {};

    const defaultVisible =
      attribute.isDefaultVisible !== undefined
        ? attribute.isDefaultVisible
        : true;

    return {
      enabled: defaultVisible,
      sortDirection: "none" as SortDirection,
      ...attributeStates[attribute.id],
    };
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { objects, onSetAttributeSort, tableId } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (const testId of objects.map((attribute) => attribute.id)) {
      const attrState = this.getAttributeState(
        objects.find((attribute: ITableAttribute) => attribute.id === testId),
      );

      if (id !== testId && attrState.sortDirection !== "none") {
        onSetAttributeSort(tableId, testId, "none");
      }
    }

    onSetAttributeSort(tableId, id, direction);
  };

  private setGroup = (id: string) => {
    const { groupBy, onSetGroupingAttribute, tableId } = this.props;
    if (groupBy === id) {
      onSetGroupingAttribute(tableId, undefined);
    } else {
      onSetGroupingAttribute(tableId, id);
    }
  };

  private setFilter = (attributeId?: string, filter?: any) => {
    const { onSetAttributeFilter, tableId } = this.props;
    onSetAttributeFilter(tableId, attributeId, filter);
    this.deselectAll();
  };

  private clearFilters = () => {
    this.setFilter();
  };

  private useMultiSelect() {
    // default to true
    return this.props.multiSelect !== false;
  }

  private updateState(newState: IComponentState, callback?: () => void) {
    if (_.isEqual(newState, this.state)) {
      if (callback !== undefined) {
        callback();
      }
      return;
    }
    this.mNextState = newState;
    if (this.mMounted) {
      this.setState(newState, callback);
    }
  }
}

const emptyObj = {};
const emptyList = [];

function mapStateToProps(state: IState, ownProps: any): IConnectedProps {
  let groupBy = state.settings.tables[ownProps.tableId]?.groupBy;
  if ((ownProps.columnBlacklist ?? []).includes(groupBy)) {
    groupBy = undefined;
  }
  return {
    // Defensive check: interface might not be initialized during hydration
    language: state.settings?.interface?.language ?? "en",
    attributeState: getSafe(
      state,
      ["settings", "tables", ownProps.tableId, "attributes"],
      emptyObj,
    ),
    filter: state.settings.tables[ownProps.tableId]?.filter,
    groupBy,
    collapsedGroups: getSafe(
      state,
      ["settings", "tables", ownProps.tableId, "collapsedGroups"],
      emptyList,
    ),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetAttributeVisible: (
      tableId: string,
      attributeId: string,
      visible: boolean,
    ) => dispatch(setAttributeVisible(tableId, attributeId, visible)),
    onSetAttributeSort: (
      tableId: string,
      attributeId: string,
      dir: SortDirection,
    ) => dispatch(setAttributeSort(tableId, attributeId, dir)),
    onSetAttributeFilter: (tableId: string, attributeId: string, filter: any) =>
      dispatch(setAttributeFilter(tableId, attributeId, filter)),
    onSetGroupingAttribute: (tableId: string, attributeId: string) =>
      dispatch(setGroupingAttribute(tableId, attributeId)),
    onCollapseGroup: (tableId: string, groupId: string, collapse: boolean) =>
      dispatch(collapseGroup(tableId, groupId, collapse)),
    onSetCollapsedGroups: (tableId: string, collapsed: string[]) =>
      dispatch(setCollapsedGroups(tableId, collapsed)),
  };
}

function registerTableAttribute(
  instanceGroup: string,
  group: string,
  attribute: ITableAttribute,
) {
  if (instanceGroup === group) {
    return attribute;
  } else {
    return undefined;
  }
}

function getTableState(state: IState, tableId: string) {
  return state.settings.tables[tableId];
}

type GetSelection = OutputSelector<
  any,
  string[],
  (res: ITableState) => string[]
>;

export function makeGetSelection(tableId: string): GetSelection {
  const getTableStateInst = (state: any) => getTableState(state, tableId);
  return createSelector(getTableStateInst, (tableState: ITableState) => {
    return Object.keys(tableState.rows).filter(
      (rowId: string) => tableState.rows[rowId].selected,
    );
  });
}

export default translate(["common"])(
  extend(
    registerTableAttribute,
    "tableId",
  )(connect(mapStateToProps, mapDispatchToProps)(SuperTable)),
) as React.ComponentType<IBaseProps & IExtensibleProps>;
