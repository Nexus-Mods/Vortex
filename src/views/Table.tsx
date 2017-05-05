import {selectRows, setAttributeFilter, setAttributeSort,
        setAttributeVisible, setSplitPos} from '../actions/tables';
import {IActionDefinition} from '../types/IActionDefinition';
import {IAttributeState} from '../types/IAttributeState';
import {IRowState, IState, ITableState} from '../types/IState';
import {ITableAttribute} from '../types/ITableAttribute';
import {SortDirection} from '../types/SortDirection';
import {ComponentEx, connect, extend, translate} from '../util/ComponentEx';
import Debouncer from '../util/Debouncer';
import {IExtensibleProps} from '../util/ExtensionProvider';
import {getSafe, setSafe} from '../util/storeHelper';
import {truthy} from '../util/util';

import IconBar from './IconBar';
import AttributeToggle from './table/AttributeToggle';
import HeaderCell from './table/HeaderCell';
import TableDetail from './table/TableDetail';
import TableRow from './table/TableRow';

import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as React from 'react';
import update = require('react-addons-update');
import {Table} from 'react-bootstrap';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import * as SplitPane from 'react-split-pane';
import { createSelector } from 'reselect';

export type ChangeDataHandler = (rowId: string, attributeId: string, newValue: any) => void;

export interface ITableRowAction extends IActionDefinition {
  singleRowAction?: boolean;
  multiRowAction?: boolean;
}

export interface IBaseProps {
  tableId: string;
  data: { [rowId: string]: any };
  actions: ITableRowAction[];
}

interface IConnectedProps {
  attributeState: { [id: string]: IAttributeState };
  rowState: { [id: string]: IRowState };
  splitPos: number;
  language: string;
  filter: { [id: string]: any };
}

interface IActionProps {
  onSelectRows: (tableId: string, rowIds: string[], selected: boolean) => void;
  onSetAttributeVisible: (tableId: string, attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (tableId: string, attributeId: string, direction: SortDirection) => void;
  onSetAttributeFilter: (tableId: string, attributeId: string, filter: any) => void;
  onSetSplitPos: (tableId: string, pos: number) => void;
}

interface IExtensionProps {
  objects: ITableAttribute[];
}

export interface ILookupCalculated {
  [rowId: string]: { [attributeId: string]: any };
}

interface IComponentState {
  lastSelected?: string;
  calculatedValues?: ILookupCalculated;
  splitMax: number;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & IExtensionProps;

/**
 * a wrapper for the react-bootstrap table adding various features:
 * - desktop-like selection/multi-selection
 * - sorting
 * - toggleable columns
 * - a detail-pane that gives additional detail on the (last) selected row
 */
class SuperTable extends ComponentEx<IProps, IComponentState> {

  private mVisibleAttributes: ITableAttribute[];
  private mSplitDebouncer: Debouncer;
  private mSplitContainer: any;

  constructor(props: IProps) {
    super(props);
    this.state = {
      lastSelected: Object.keys(props.rowState).find((key) => props.rowState[key].selected),
      calculatedValues: undefined,
      splitMax: 9999,
    };
    this.mVisibleAttributes = this.visibleAttributes(props.objects, props.attributeState);
    this.updateCalculatedValues(props);

    this.mSplitDebouncer = new Debouncer((...args) => {
      props.onSetSplitPos(props.tableId, args[0]);
      return null;
    }, 100);
  }

  public componentWillMount() {
    this.updateSelection(this.props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.data !== this.props.data) {
      this.updateCalculatedValues(newProps);
      this.updateSelection(newProps);
    }
    if (newProps.attributeState !== this.props.attributeState) {
      const { attributeState, objects } = newProps;
      this.mVisibleAttributes = this.visibleAttributes(objects, attributeState);
    }
  }

  public render(): JSX.Element {
    const { t, actions, objects, splitPos, tableId } = this.props;
    const { splitMax } = this.state;
    const { lastSelected } = this.state;

    let hasActions = false;
    if (actions !== undefined) {
      const rowActions = actions.filter((action) =>
        action.singleRowAction === undefined || action.singleRowAction);
      hasActions = rowActions.length > 0;
    }

    const actionHeader = hasActions
      ? (
        <th className={`table-${tableId} header-action`}>
          <div>
            <p className='vcenter'>{t('Actions')}</p>
          </div>
        </th>
      ) : null;

    return (
      <Layout className='table-layout' type='column'>
        <Fixed>
          <div className='pull-right'>
            {objects.map(this.renderAttributeToggle)}
          </div>
        </Fixed>
        <Flex>
          <SplitPane
            split='vertical'
            maxSize={splitMax}
            defaultSize={splitPos}
            onChange={this.changeSplitPos}
            primary='second'
            ref={this.setSplitRef}
          >
            <div className='table-main-pane' ref={this.mainPaneRef}>
              <Table condensed hover>
                <thead style={{ transform: 'translate(0, 0)' }}>
                  <tr>
                    {this.mVisibleAttributes.map(this.renderHeaderField)}
                    { actionHeader }
                  </tr>
                </thead>
                {this.renderBody(this.mVisibleAttributes)}
              </Table>
            </div>
            <div className='table-details-pane'>
              {this.renderDetails(lastSelected)}
            </div>
          </SplitPane>
        </Flex>
        <Fixed>
          {this.renderSelectionActions()}
        </Fixed>
      </Layout>
      );
  }

  private renderBody = (visibleAttributes: ITableAttribute[]) => {
    const { attributeState, data, language } = this.props;
    const { calculatedValues } = this.state;

    if (calculatedValues === undefined) {
      return null;
    }

    const filtered: { [key: string]: any } = this.filteredRows(visibleAttributes, data);
    const sorted: any[] = this.sortedRows(attributeState, visibleAttributes, filtered, language);
    return (
      <tbody>
        {sorted.map((row) => this.renderRow(row, visibleAttributes))}
      </tbody>
    );
  }

  private setSplitRef = (ref) => {
    this.mSplitContainer = ref;
  }

  private translateHeader(event) {
    const translate = `translate(0, ${event.target.scrollTop}px)`;
    event.target.querySelector('thead').style.transform = translate;
  }

  private mainPaneRef = (ref) => {
    if (ref === null) {
      return;
    }

    // not sure if this is necessary, I guess not
    ref.removeEventListener('scroll', this.translateHeader);

    // translate the header so that it remains in view during scrolling
    ref.addEventListener('scroll', this.translateHeader);
  }

  private changeSplitPos = (value) => {
    this.mSplitDebouncer.schedule(undefined, value);
    const totalWidth = this.mSplitContainer.splitPane.offsetWidth;
    const maxWidth = Math.min(
      totalWidth * 0.5,
      totalWidth - 700,
    );

    if (maxWidth !== this.state.splitMax) {
      this.setState(update(this.state, {
        splitMax: { $set: maxWidth },
      }));
    }
  }

  private updateCalculatedValues(props) {
    const { t, data, objects } = props;

    let newValues: ILookupCalculated = this.state.calculatedValues || {};

    // recalculate each attribute in each row
    Promise.map(Object.keys(data), (rowId: string) => {
      if (newValues[rowId] === undefined) {
        newValues = update(newValues, {
          [rowId]: { $set: { __id: rowId } },
        });
      }
      return Promise.map(objects, (attribute: ITableAttribute) =>
        Promise.resolve(attribute.calc(data[rowId], t))
          .then((newValue) => {
            if (!_.isEqual(newValue, newValues[rowId][attribute.id])) {
              newValues = update(newValues, {
                [rowId]: {
                  [attribute.id]: { $set: newValue },
                },
              });
            }
          }));
    }).then(() => {
      // once everything is recalculated, update the cache
      this.setState(update(this.state, {
        calculatedValues: { $set: newValues },
      }));
    });
  }

  private updateSelection(props: IProps) {
    // unselect rows that are no longer in the data
    const vanished = Object.keys(props.rowState).filter(rowId =>
      props.rowState[rowId].selected && (props.data[rowId] === undefined));
    props.onSelectRows(props.tableId, vanished, false);
  }

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1
      : lhs === rhs  ? 0
      : 1;
  }

  private filteredRows(attributes: ITableAttribute[],
                       data: { [id: string]: any }) {
    const { filter } = this.props;
    const { calculatedValues } = this.state;

    if (filter === undefined) {
      return data;
    }

    const result = {};
    Object.keys(calculatedValues).filter(rowId => {
      // filter out rows which no longer exist
      if (data[rowId] === undefined) {
        return false;
      }
      // return only elements for which we can't find a non-matching filter
      // (in other work: Keep only those items that match all filters)
      return attributes.find(attribute => {
        if (attribute.filter === undefined) {
          return false;
        }

        const value = attribute.filter.raw
          ? data[rowId].attributes[attribute.id]
          : calculatedValues[rowId][attribute.id];

        return truthy(filter[attribute.id])
        && !attribute.filter.matches(filter[attribute.id], value,
                                     this.context.api.store.getState());
      }) === undefined;
    })
    .forEach(key => result[key] = data[key]);
    return result;
  }

  private sortedRows(attributeState: { [id: string]: IAttributeState },
                     attributes: ITableAttribute[],
                     data: { [id: string]: any },
                     locale: string): any[] {
    const { calculatedValues } = this.state;

    const sortAttribute: ITableAttribute = attributes.find((attribute: ITableAttribute) => {
      return (attributeState[attribute.id] !== undefined)
          && (attributeState[attribute.id].sortDirection !== 'none');
    });

    const idsToRows = (rowId: string) => ({
      id: rowId,
      data: data[rowId],
    });

    // return unsorted if no sorting column was selected or if the values
    // haven't been calculated yet
    if (sortAttribute === undefined) {
      return Object.keys(data).map(idsToRows);
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = this.standardSort;
    }

    const descending = attributeState[sortAttribute.id].sortDirection === 'desc';

    const dataIds = Object.keys(data).filter((key) => calculatedValues[key] !== undefined);

    return dataIds.sort((lhsId: string, rhsId: string): number => {
      let res = 0;
      if (calculatedValues[lhsId][sortAttribute.id] === undefined) {
        res = calculatedValues[rhsId][sortAttribute.id] === undefined ? 0 : -1;
      } else if (calculatedValues[rhsId][sortAttribute.id] === undefined) {
        res = 1;
      } else {
        res = sortFunction(calculatedValues[lhsId][sortAttribute.id],
          calculatedValues[rhsId][sortAttribute.id],
          locale);
      }

      if (descending) {
        res *= -1;
      }
      return res;
    }).map(idsToRows);
  }

  private renderDetails = (rowId: string) => {
    if ((rowId === undefined) || (this.state.calculatedValues === undefined)) {
      return null;
    }

    const {t, data, language, objects} = this.props;

    const detailAttributes = objects.filter((attribute: ITableAttribute) =>
      attribute.placement !== 'table');

    const rowData = this.state.calculatedValues[rowId];

    if ((rowData === undefined) || (data[rowId] === undefined)) {
      return null;
    }

    return (
      <TableDetail
        t={t}
        rowId={rowId}
        rowData={rowData}
        rawData={data[rowId]}
        attributes={detailAttributes}
        language={language}
      />
    );
  }

  private renderSelectionActions(): JSX.Element {
    const {t, actions, rowState, tableId} = this.props;

    const selected = Object.keys(rowState).filter((key: string) => rowState[key].selected);
    const selectedCount = selected.length;

    if (selectedCount === 0) {
      return null;
    }

    const multiActions = actions.filter(
      (action) => action.multiRowAction === undefined || action.multiRowAction);

    // TODO the styling here is a bit of a hack
    return (
      <div>
        <h4 style={{ display: 'inline-block' }}>
          {t('{{count}} selected', { replace: { count: selectedCount } })}
        </h4>
        {' '}
        <IconBar
          group={`${tableId}-multiaction-icons`}
          className='table-actions'
          style={{ marginBottom: 5 }}
          tooltipPlacement='top'
          staticElements={multiActions}
          instanceId={selected}
        />
      </div>
    );
  }

  private renderAttributeToggle = (attr: ITableAttribute) => {
    const { t } = this.props;

    const attributeState = this.getAttributeState(attr);

    return !attr.isToggleable ? null : (
      <AttributeToggle
        key={attr.id}
        attribute={attr}
        state={attributeState}
        t={t}
        onSetAttributeVisible={this.setAttributeVisible}
      />
    );
  }

  private setAttributeVisible = (attributeId: string, visible: boolean) => {
    const { onSetAttributeVisible, tableId } = this.props;
    onSetAttributeVisible(tableId, attributeId, visible);
  }

  private selectRow = (evt: React.MouseEvent<any>) => {
    let iter = evt.target as any;
    while (['BUTTON', 'TR', null].indexOf(iter.tagName) === -1) {
      iter = iter.parentNode;
    }
    if (iter.tagName === 'BUTTON') {
      // don't handle if the click was on a button
      return;
    }

    const row = (evt.currentTarget as HTMLTableRowElement);

    const {attributeState, onSelectRows, rowState, tableId} = this.props;

    if (evt.ctrlKey) {
      // ctrl-click -> toggle the selected row, leave remaining selection intact
      const wasSelected = getSafe(rowState, [row.id, 'selected'], false);
      if (!wasSelected) {
        this.setState(setSafe(this.state, ['lastSelected'], row.id));
      }
      onSelectRows(tableId, [row.id], !wasSelected);
    } else if (evt.shiftKey) {
      // shift-click -> select everything between this row and the last one clicked,
      //                deselect everything else
      const { objects, data, language } = this.props;
      const visibleAttributes: ITableAttribute[] =
        this.visibleAttributes(objects, attributeState);

      const selection: Set<string> = new Set([row.id, this.state.lastSelected]);
      let selecting = false;

      this.sortedRows(attributeState, visibleAttributes, data, language)
      .forEach((iterRow: any) => {
        let isBracket = (iterRow.id === row.id) || (iterRow.id === this.state.lastSelected);
        if (!selecting && isBracket) {
          selecting = true;
          isBracket = false;
        }

        if (selecting) {
          selection.add(iterRow.id);
          if (isBracket) {
            selecting = false;
          }
        }
      });
      onSelectRows(tableId, Object.keys(rowState), false);
      onSelectRows(tableId, Array.from(selection), true);
    } else {
      // regular click -> select only the clicked row, everything else get deselected
      this.setState(setSafe(this.state, ['lastSelected'], row.id));
      onSelectRows(tableId, Object.keys(rowState), false);
      onSelectRows(tableId, [row.id], true);
    }
  }

  private renderRow(data: any, visibleAttributes: ITableAttribute[]): JSX.Element {
    const { t, actions, language, rowState, tableId } = this.props;
    const { calculatedValues } = this.state;

    if (calculatedValues[data.id] === undefined) {
      return null;
    }

    const rowActions = actions.filter(
      (action) => (action.singleRowAction === undefined) || action.singleRowAction);

    return (
      <TableRow
        t={t}
        tableId={tableId}
        key={data.id}
        data={calculatedValues[data.id]}
        rawData={data.data}
        attributes={visibleAttributes}
        actions={rowActions}
        language={language}
        onClick={this.selectRow}
        selected={getSafe(rowState, [data.id, 'selected'], false)}
      />
    );
  }

  private visibleAttributes(attributes: ITableAttribute[],
                            attributeStates: { [id: string]: IAttributeState }): ITableAttribute[] {
    return attributes.filter((attribute: ITableAttribute) => {
      const state = this.getAttributeState(attribute, attributeStates);
      if (attribute.placement === 'detail') {
        return false;
      } else {
        return state.enabled;
      }
    });
  }

  private renderHeaderField = (attribute: ITableAttribute): JSX.Element => {
    const { t, filter, tableId } = this.props;

    const attributeState = this.getAttributeState(attribute);

    const filt = (attribute.filter !== undefined) && (filter !== undefined)
      ? (filter[attribute.id] || null)
      : undefined;

    if (attributeState.enabled) {
      return (
        <HeaderCell
          className={`table-${tableId} header-${attribute.id}`}
          key={attribute.id}
          attribute={attribute}
          state={attributeState}
          doFilter={filt !== undefined}
          onSetSortDirection={ this.setSortDirection }
          onSetFilter={ this.setFilter }
          t={t}
        >
          {attribute.filter !== undefined ? (
            <attribute.filter.component
              filter={filt}
              attributeId={attribute.id}
              t={t}
              onSetFilter={this.setFilter}
            />
         ) : null }
        </HeaderCell>
      );
    } else {
      return null;
    }
  }

  private getAttributeState(attribute: ITableAttribute,
                            attributeStatesIn?: { [id: string]: IAttributeState }) {
    const attributeStates = attributeStatesIn || this.props.attributeState;

    const defaultVisible =
      attribute.isDefaultVisible !== undefined ? attribute.isDefaultVisible : true;

    return Object.assign({
      enabled: defaultVisible,
      sortDirection: 'none' as SortDirection,
    }, attributeStates[attribute.id]);
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { objects, onSetAttributeSort, tableId } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (const testId of objects.map((attribute) => attribute.id)) {
      const attrState = this.getAttributeState(
        objects.find((attribute: ITableAttribute) => attribute.id === testId));

      if ((id !== testId) && (attrState.sortDirection !== 'none')) {
        onSetAttributeSort(tableId, testId, 'none');
      }
    }

    onSetAttributeSort(tableId, id, direction);
  }

  private setFilter = (attributeId?: string, filter?: any) => {
    const { onSetAttributeFilter, tableId } = this.props;
    onSetAttributeFilter(tableId, attributeId, filter);
  }
}

function mapStateToProps(state: any, ownProps: IBaseProps): IConnectedProps {
  return {
    language: state.settings.interface.language,
    attributeState: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'attributes'], {}),
    rowState: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'rows'], {}),
    splitPos: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'splitPos'], 200),
    filter: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'filter'], undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onSelectRows: (tableId: string, rowIds: string[], selected: boolean) =>
      dispatch(selectRows(tableId, rowIds, selected)),
    onSetAttributeVisible: (tableId: string, attributeId: string, visible: boolean) =>
      dispatch(setAttributeVisible(tableId, attributeId, visible)),
    onSetAttributeSort: (tableId: string, attributeId: string, dir: SortDirection) =>
      dispatch(setAttributeSort(tableId, attributeId, dir)),
    onSetSplitPos: (tableId: string, pos: number) => dispatch(setSplitPos(tableId, pos)),
    onSetAttributeFilter: (tableId: string, attributeId: string, filter: any) =>
      dispatch(setAttributeFilter(tableId, attributeId, filter)),
  };
}

function registerTableAttribute(instance: SuperTable, group: string, attribute: ITableAttribute) {
  if (instance.props.tableId === group) {
    return attribute;
  } else {
    return undefined;
  }
}

function getTableState(state: IState, tableId: string) {
  return state.persistent.tables[tableId];
}

export function makeGetSelection(tableId: string) {
  const getTableStateInst = (state: any) => getTableState(state, tableId);
  return createSelector(getTableStateInst, (tableState: ITableState) => {
    return Object.keys(tableState.rows).filter((rowId: string) => (
      tableState.rows[rowId].selected
    ));
  });
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerTableAttribute)(
        SuperTable))) as React.ComponentClass<IBaseProps & IExtensibleProps>;
