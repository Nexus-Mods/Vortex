
import {selectRows, setAttributeSort, setAttributeVisible} from '../actions/tables';
import {IAttributeState} from '../types/IAttributeState';
import {IIconDefinition} from '../types/IIconDefinition';
import {IRowState, IState, ITableState} from '../types/IState';
import {ITableAttribute} from '../types/ITableAttribute';
import {SortDirection} from '../types/SortDirection';
import {ComponentEx, connect, extend, translate} from '../util/ComponentEx';
import {IExtensibleProps} from '../util/ExtensionProvider';
import {getSafe, setSafe} from '../util/storeHelper';
import {IconButton} from '../views/TooltipControls';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import IconBar from './IconBar';

import * as Promise from 'bluebird';
import * as React from 'react';
import update = require('react-addons-update');
import {ControlLabel, FormControl, FormGroup, Table} from 'react-bootstrap';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import { createSelector } from 'reselect';

export interface IChangeDataHandler {
  (rowId: string, attributeId: string, newValue: any): void;
}

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  rowData: any;
  t: I18next.TranslationFunction;
  onChangeData: IChangeDataHandler;
}

class TableCell extends React.Component<ICellProps, {}> {
  public render(): JSX.Element {
    const { t, attribute, language, rowData, rowId } = this.props;

    // if a custom renderer was set then rowData is the raw object
    // passed to the table by the user.
    // otherwise rowData is the calculated value of this cell

    if (attribute.customRenderer !== undefined) {
      return attribute.customRenderer(rowData, t);
    }

    if (rowData instanceof Date) {
      return <span>{rowData.toLocaleString(language)}</span>;
    } else if (typeof (rowData) === 'string') {
      return <span>{rowData}</span>;
    } else if (typeof (rowData) === 'boolean') {
      return <IconButton
        className='btn-embed'
        id={`toggle-${rowId}-${attribute.id}`}
        tooltip={attribute.name}
        icon={ rowData ? 'check-square-o' : 'square-o' }
        onClick={this.toggle}
      />;
    } else if ((rowData === undefined) || (rowData === null)) {
      return <span>{' '}</span>;
    } else {
      return <span>{rowData.toString()}</span>;
    }
  }

  private toggle = () => {
    const { attribute, rowData, rowId } = this.props;
    const value = rowData;
    this.props.onChangeData(rowId, attribute.id, !value);
  }
}

class DetailCell extends React.Component<ICellProps, {}> {
  public render(): JSX.Element {
    const { t, attribute, rowData, rowId } = this.props;
    const value = rowData[attribute.id];

    const key = `${rowId}-${attribute.id}`;

    let content: JSX.Element = null;

    if (attribute.customRenderer !== undefined) {
      content = (
        <FormControl.Static>
          { attribute.customRenderer(rowData, t) }
        </FormControl.Static>
      );
    } else {
      content = (
        <FormControl
          id={attribute.id}
          type='text'
          label={t(attribute.name)}
          readOnly={attribute.isReadOnly}
          defaultValue={this.renderCell(value)}
        />
      );
    }

    return (
      <FormGroup key={key}>
        <ControlLabel>{attribute.name}</ControlLabel>
        {content}
      </FormGroup>
    );
  }

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof(value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }
}

interface IRowProps {
  t: I18next.TranslationFunction;
  tableId: string;
  key: string;
  data: any;
  rawData: any;
  attributes: ITableAttribute[];
  actions: IIconDefinition[];
  language: string;
  onChangeData: IChangeDataHandler;
  onClick: React.MouseEventHandler<any>;
  selected: boolean;
}

class TableRow extends React.Component<IRowProps, {}> {
  public render(): JSX.Element {
    const { attributes, data, onClick, selected, tableId, actions } = this.props;

    let classes = [];
    if (selected) {
      classes.push('table-selected');
    }

    return (
      <tr
        id={data.__id}
        key={data.__id}
        className={classes.join(' ')}
        onClick={onClick}
      >
        {attributes.map(this.renderAttribute)}
        <td style={{ textAlign: 'center' }}>
          <IconBar
            group={`${tableId}-action-icons`}
            instanceId={data.__id}
            className='table-actions'
            staticElements={actions}
          />
        </td>
      </tr>
    );
  }

  private renderAttribute = (attribute: ITableAttribute): JSX.Element => {
    const { t, data, rawData } = this.props;
    return (
      <td key={attribute.id}>
        {this.renderCell(attribute, attribute.customRenderer ? rawData : data[attribute.id], t)}
      </td>
    );
  }

  private renderCell(
    attribute: ITableAttribute,
    rowData: any,
    t: I18next.TranslationFunction): JSX.Element {

    const { data, language, onChangeData } = this.props;

    return <TableCell
      t={t}
      attribute={attribute}
      rowData={rowData}
      rowId={data.__id}
      language={language}
      onChangeData={onChangeData}
    />;
  }
}

export interface ITableRowAction extends IIconDefinition {
  singleRowAction?: boolean;
  multiRowAction?: boolean;
}

export interface IBaseProps {
  tableId: string;
  data: { [rowId: string]: any };
  actions: ITableRowAction[];
  onChangeData?: IChangeDataHandler;
}

interface IConnectedProps {
  attributeState: { [id: string]: IAttributeState };
  rowState: { [id: string]: IRowState };
  language: string;
}

interface IActionProps {
  onSelectRows: (tableId: string, rowIds: string[], selected: boolean) => void;
  onSetAttributeVisible: (tableId: string, attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (tableId: string, attributeId: string, direction: SortDirection) => void;
}

interface IExtensionProps {
  objects: ITableAttribute[];
}

type LookupCalculated = { [rowId: string]: { [attributeId: string]: any } };

interface IComponentState {
  lastSelected?: string;
  calculatedValues?: LookupCalculated;
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
  constructor(props: IProps) {
    super(props);
    this.state = {
      lastSelected: undefined,
      calculatedValues: undefined,
    };
  }

  public componentDidMount() {
    this.updateCalculatedValues(this.props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.data !== this.props.data) {
      this.updateCalculatedValues(newProps);
    }
  }

  public render(): JSX.Element {
    const { t, attributeState, objects } = this.props;
    const { lastSelected } = this.state;

    const visibleAttributes = this.visibleAttributes(objects, attributeState);

    return (
      <Layout type='column'>
        <Fixed>
          <div className='pull-right'>
            {objects.map(this.renderAttributeToggle)}
          </div>
        </Fixed>
        <Flex>
          <Layout type='row'>
            <Flex style={{ height: '100%', overflowY: 'auto' }} >
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    {visibleAttributes.map(this.renderHeaderField)}
                    <th>{t('Actions')}</th>
                  </tr>
                </thead>
                { this.renderBody(visibleAttributes) }
              </Table>
            </Flex>
            <Fixed>
              {this.renderDetails(lastSelected)}
            </Fixed>
          </Layout>
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

  private updateCalculatedValues(props) {
    const { t, data, objects } = props;

    let newValues: LookupCalculated = {};

    // recalculate each attribute in each row
    Promise.map(Object.keys(data), (rowId: string) => {
      newValues[rowId] = { __id: rowId };
      return Promise.map(objects, (attribute: ITableAttribute) =>
        Promise.resolve(attribute.calc(data[rowId], t))
          .then((newValue) => newValues[rowId][attribute.id] = newValue)
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

    let idsToRows = (rowId: string) =>
      Object.assign({}, data[rowId], {
        __id: rowId,
      });

    let dataIds = Object.keys(data);

    // return unsorted if no sorting column was selected or if the values
    // haven't been calculated yet
    if ((sortAttribute === undefined) || (calculatedValues === undefined)) {
      return dataIds.map(idsToRows);
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = this.standardSort;
    }

    let descending = attributeState[sortAttribute.id].sortDirection === 'desc';

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

  private renderDetail = (rowData: any, attribute: ITableAttribute) => {
    const { t, language, onChangeData } = this.props;

    return <DetailCell
      t={t}
      key={`detail-${rowData.__id}-${attribute.id}`}
      attribute={attribute}
      language={language}
      rowData={rowData}
      rowId={rowData.__id}
      onChangeData={onChangeData}
    />;
  }

  private renderDetails = (rowId: string) => {
    if (rowId === undefined) {
      return null;
    }

    const {objects} = this.props;
    const {calculatedValues} = this.state;

    const rowData = calculatedValues[rowId];

    const detailAttributes = objects.filter((attribute: ITableAttribute) =>
      attribute.placement !== 'table'
    );

    if (rowData === undefined) {
      return null;
    }

    return (
      <form style={{ minWidth: 300 }}>
      {detailAttributes.map((obj) => this.renderDetail(rowData, obj))}
      </form>
    );
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

    let attribute = this.getAttributeState(attr.id);

    return !attr.isToggleable ? null : (
      <AttributeToggle
        key={attr.id}
        attribute={attr}
        state={attribute}
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
        let isBracket = (iterRow.__id === row.id) || (iterRow.__id === this.state.lastSelected);
        if (!selecting && isBracket) {
          selecting = true;
          isBracket = false;
        }

        if (selecting) {
          selection.add(iterRow.__id);
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
    const { t, actions, language, onChangeData, rowState, tableId } = this.props;
    const { calculatedValues } = this.state;

    if (calculatedValues[data.__id] === undefined) {
      return null;
    }

    const rowActions = actions.filter(
      (action) => action.singleRowAction === undefined || action.singleRowAction);

    return (
      <TableRow
        t={t}
        tableId={tableId}
        key={data.__id}
        data={calculatedValues[data.__id]}
        rawData={data}
        attributes={visibleAttributes}
        actions={rowActions}
        language={language}
        onChangeData={onChangeData}
        onClick={this.selectRow}
        selected={getSafe(rowState, [data.__id, 'selected'], false)}
      />
    );
  }

  private visibleAttributes(attributes: ITableAttribute[],
                            attributeStates: { [id: string]: IAttributeState }): ITableAttribute[] {
    return attributes.filter((attribute: ITableAttribute) => {
      if (attribute.placement === 'detail') {
        return false;
      } else if (!attributeStates.hasOwnProperty(attribute.id)) {
        return true;
      } else {
        return getSafe(attributeStates, [attribute.id, 'enabled'], true);
      }
    });
  }

  private renderHeaderField = (attribute: ITableAttribute): JSX.Element => {
    const { t } = this.props;

    const attributeState = this.getAttributeState(attribute.id);

    if (attributeState.enabled === undefined || attributeState.enabled) {
      return (
        <HeaderCell
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

  private getAttributeState(attributeId: string) {
    const { attributeState } = this.props;

    return getSafe(attributeState, [attributeId], {
      enabled: true,
      sortDirection: 'none' as SortDirection,
    });
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { attributeState, onSetAttributeSort, tableId } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (let testId of Object.keys(attributeState)) {
      const attrState = this.getAttributeState(testId);

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
