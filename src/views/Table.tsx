import {selectRows, setAttributeSort, setAttributeVisible, setSplitPos} from '../actions/tables';
import {IAttributeState} from '../types/IAttributeState';
import {IIconDefinition} from '../types/IIconDefinition';
import {IRowState, IState, ITableState} from '../types/IState';
import {ITableAttribute} from '../types/ITableAttribute';
import {SortDirection} from '../types/SortDirection';
import {ComponentEx, connect, extend, translate} from '../util/ComponentEx';
import Debouncer from '../util/Debouncer';
import {IExtensibleProps} from '../util/ExtensionProvider';
import {getSafe, setSafe} from '../util/storeHelper';

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

export interface IChangeDataHandler {
  (rowId: string, attributeId: string, newValue: any): void;
}

export interface ITableRowAction extends IIconDefinition {
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
}

interface IActionProps {
  onSelectRows: (tableId: string, rowIds: string[], selected: boolean) => void;
  onSetAttributeVisible: (tableId: string, attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (tableId: string, attributeId: string, direction: SortDirection) => void;
  onSetSplitPos: (tableId: string, pos: number) => void;
}

interface IExtensionProps {
  objects: ITableAttribute[];
}

type LookupCalculated = { [rowId: string]: { [attributeId: string]: any } };

interface IComponentState {
  lastSelected?: string;
  calculatedValues?: LookupCalculated;
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

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.data !== this.props.data) {
      this.updateCalculatedValues(newProps);
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

    return (
      <Layout type='column'>
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
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    {this.mVisibleAttributes.map(this.renderHeaderField)}
                    {hasActions
                      ? <th className={`table-${tableId} header-action`}>{t('Actions')}</th>
                      : null
                    }
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

    let sorted: any[] = this.sortedRows(attributeState, visibleAttributes, data, language);
    return <tbody>
      {sorted.map((row) => this.renderRow(row, visibleAttributes))}
    </tbody>;
  }

  private setSplitRef = (ref) => {
    this.mSplitContainer = ref;
  }

  private translateHeader(event) {
    let translate = `translate(0, ${event.target.scrollTop}px)`;
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
    let maxWidth = Math.min(
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

    let newValues: LookupCalculated = this.state.calculatedValues || {};

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
          })
      );
    }).then(() => {
      // once everything is recalculated, update the cache
      this.setState(update(this.state, {
        calculatedValues: { $set: newValues },
      }));
    });
  }

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1
      : lhs === rhs  ? 0
      : 1;
  }

  private sortedRows(attributeState: { [id: string]: IAttributeState },
                     attributes: ITableAttribute[],
                     data: { [id: string]: any },
                     locale: string): any[] {
    const { calculatedValues } = this.state;

    let sortAttribute: ITableAttribute = attributes.find((attribute: ITableAttribute) => {
      return (attributeState[attribute.id] !== undefined)
          && (attributeState[attribute.id].sortDirection !== 'none');
    });

    let idsToRows = (rowId: string) => ({
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

    let descending = attributeState[sortAttribute.id].sortDirection === 'desc';

    let dataIds = Object.keys(data).filter((key) => calculatedValues[key] !== undefined);

    return dataIds.sort((lhsId: string, rhsId: string): number => {
      let res = sortFunction(calculatedValues[lhsId][sortAttribute.id],
                             calculatedValues[rhsId][sortAttribute.id],
                             locale);
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
      attribute.placement !== 'table'
    );

    const rowData = this.state.calculatedValues[rowId];

    if (rowData === undefined) {
      return null;
    }

    return <TableDetail
      t={t}
      rowId={rowId}
      rowData={rowData}
      rawData={data[rowId]}
      attributes={detailAttributes}
      language={language}
    />;
  };

  private renderSelectionActions(): JSX.Element {
    const {t, actions, rowState} = this.props;

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
          group='${tableId}-multiaction-icons'
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

    let attributeState = this.getAttributeState(attr);

    return !attr.isToggleable ? null : (
      <AttributeToggle
        key={attr.id}
        attribute={attr}
        state={attributeState}
        t={t}
        onSetAttributeVisible={this.setAttributeVisible}
      />
    );
  };

  private setAttributeVisible = (attributeId: string, visible: boolean) => {
    const { onSetAttributeVisible, tableId } = this.props;
    onSetAttributeVisible(tableId, attributeId, visible);
  }

  private selectRow = (evt: React.MouseEvent<any>) => {
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

      let selection: Set<string> = new Set([row.id, this.state.lastSelected]);
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
  };

  private renderRow(data: any, visibleAttributes: ITableAttribute[]): JSX.Element {
    const { t, actions, language, rowState, tableId } = this.props;
    const { calculatedValues } = this.state;

    if (calculatedValues[data.id] === undefined) {
      return null;
    }

    const rowActions = actions.filter(
      (action) => action.singleRowAction === undefined || action.singleRowAction);

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
      let state = this.getAttributeState(attribute, attributeStates);
      if (attribute.placement === 'detail') {
        return false;
      } else {
        return state.enabled;
      }
    });
  }

  private renderHeaderField = (attribute: ITableAttribute): JSX.Element => {
    const { t, tableId } = this.props;

    const attributeState = this.getAttributeState(attribute);

    if (attributeState.enabled) {
      return (
        <HeaderCell
          className={`table-${tableId} header-${attribute.id}`}
          key={attribute.id}
          attribute={attribute}
          state={attributeState}
          onSetSortDirection={ this.setSortDirection }
          t={t}
        />
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
    for (let testId of objects.map((attribute) => attribute.id)) {
      const attrState = this.getAttributeState(
        objects.find((attribute: ITableAttribute) => attribute.id === testId));

      if ((id !== testId) && (attrState.sortDirection !== 'none')) {
        onSetAttributeSort(tableId, testId, 'none');
      }
    }

    onSetAttributeSort(tableId, id, direction);
  }
}

function mapStateToProps(state: any, ownProps: IBaseProps): IConnectedProps {
  return {
    attributeState: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'attributes'], {}),
    rowState: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'rows'], {}),
    language: state.settings.interface.language,
    splitPos: getSafe(state, ['persistent', 'tables', ownProps.tableId, 'splitPos'], 200),
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
        SuperTable
      )
    )
  ) as React.ComponentClass<IBaseProps & IExtensibleProps>;
