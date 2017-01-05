import {selectRows, setAttributeSort, setAttributeVisible} from '../actions/tables';

import {IAttributeState} from '../types/IAttributeState';
import {IIconDefinition} from '../types/IIconDefinition';
import {IState, ITableState} from '../types/IState';
import {ITableAttribute} from '../types/ITableAttribute';
import {SortDirection} from '../types/SortDirection';
import {ComponentEx, connect, extend, translate} from '../util/ComponentEx';
import {IExtensibleProps} from '../util/ExtensionProvider';
import {log} from '../util/log';
import {getSafe, setSafe} from '../util/storeHelper';
import {countIf} from '../util/util';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import IconBar from './IconBar';

import * as _ from 'lodash';
import * as React from 'react';
import {Checkbox, ControlLabel, FormControl, FormGroup, Table} from 'react-bootstrap';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import { createSelector } from 'reselect';

import * as util from 'util';

export interface IChangeDataHandler {
  (rowId: string, attributeId: string, newValue: any): void;
}

interface IRowProps {
  t: I18next.TranslationFunction;
  tableId: string;
  key: string;
  data: any;
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
    const { t, data } = this.props;
    return (
      <td key={attribute.id}>
        {this.renderCell(attribute, data, t)}
      </td>
    );
  }

  private renderCell(
    attribute: ITableAttribute,
    rowData: any,
    t: I18next.TranslationFunction): JSX.Element {

    const { language } = this.props;

    if (attribute.customRenderer !== undefined) {
      return attribute.customRenderer(rowData, t);
    }

    const value = attribute.calc(rowData, t);

    if (value instanceof Date) {
      return <span>{value.toLocaleString(language)}</span>;
    } else if (typeof (value) === 'string') {
      return <span>{value}</span>;
    } else if (typeof (value) === 'boolean') {
      return <Checkbox checked={value} />;
    } else if ((value === undefined) || (value === null)) {
      return <span>{' '}</span>;
    } else {
      return <span>{value.toString()}</span>;
    }
  }
}

export interface IBaseProps {
  tableId: string;
  data: { [rowId: string]: any };
  rowActions: IIconDefinition[];
  multiActions?: IIconDefinition[];

  onChangeData: IChangeDataHandler;
}

interface IConnectedProps {
  tableState: ITableState;
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

interface IComponentState {
  lastSelected?: string;
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
    };
  }

  public render(): JSX.Element {
    const { t, objects, data, language, tableState } = this.props;
    const { lastSelected } = this.state;

    const visibleAttributes: ITableAttribute[] =
      this.visibleAttributes(objects, tableState.attributes);
    let sorted: any[] = this.sortedRows(tableState, visibleAttributes, data, language);

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
                <tbody>
                  {sorted.map((row) => this.renderRow(row, visibleAttributes))}
                </tbody>
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

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1
      : lhs === rhs  ? 0
      : 1;
  }

  private sortedRows(tableState: ITableState,
                     attributes: ITableAttribute[],
                     data: { [id: string]: any },
                     locale: string): any[] {
    let sortAttribute: ITableAttribute = attributes.find((attribute: ITableAttribute) => {
      return (tableState.attributes[attribute.id] !== undefined)
          && (tableState.attributes[attribute.id].sortDirection !== 'none');
    });

    const rows: any[] = Object.keys(data).map((id: string) => {
      let res = data[id];
      res.__id = id;
      return res;
    });

    if (sortAttribute === undefined) {
      return rows;
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = this.standardSort;
    }

    return rows.sort((lhs: any, rhs: any): number => {
      let res = sortFunction(lhs[sortAttribute.id],
                             rhs[sortAttribute.id],
                             locale);
      if (tableState.attributes[sortAttribute.id].sortDirection === 'desc') {
        res *= -1;
      }
      return res;
    });
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

  private renderDetail = (rowData: any, attribute: ITableAttribute) => {
    const { t } = this.props;

    const key = `${rowData.__id}-${attribute.id}`;

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
          defaultValue={this.renderCell(attribute.calc(rowData, t))}
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

  private renderDetails = (rowId: string) => {
    if (rowId === undefined) {
      return null;
    }

    const {data, objects} = this.props;
    let rowData = data[rowId];

    if (rowData === undefined) {
      log('warn', 'unknown row id', rowId);
      return null;
    }

    rowData.__id = rowId;

    return (
      <form style={{ minWidth: 300 }}>
      {objects.map((obj) => this.renderDetail(rowData, obj))}
      </form>
    );
  };

  private renderSelectionActions(): JSX.Element {
    const {t, tableState} = this.props;
    let selectedCount = countIf(Object.keys(tableState.rows),
      (val: string) => tableState.rows[val].selected);

    if (selectedCount === 0) {
      return null;
    }
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
          staticElements={this.props.multiActions}
        />
      </div>
    );
  }

  private renderAttributeToggle = (attr: ITableAttribute) => {
    const { t, tableState } = this.props;

    let attributeState = getSafe<IAttributeState>(tableState, ['attributes', attr.id],
      { enabled: true, sortDirection: 'none' });

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

    const {onSelectRows, tableId, tableState} = this.props;

    const rows = getSafe(tableState, ['rows'], {});

    if (evt.ctrlKey) {
      // ctrl-click -> toggle the selected row, leave remaining selection intact
      const wasSelected = getSafe(rows, [row.id, 'selected'], false);
      if (!wasSelected) {
        this.setState(setSafe(this.state, ['lastSelected'], row.id));
      }
      onSelectRows(tableId, [row.id], !wasSelected);
    } else if (evt.shiftKey) {
      // shift-click -> select everything between this row and the last one clicked, 
      //                deselect everything else
      const { objects, data, language } = this.props;
      const visibleAttributes: ITableAttribute[] =
        this.visibleAttributes(objects, tableState.attributes);

      let selection: Set<string> = new Set([row.id, this.state.lastSelected]);
      let selecting = false;

      this.sortedRows(tableState, visibleAttributes, data, language)
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
      onSelectRows(tableId, Object.keys(rows), false);
      onSelectRows(tableId, Array.from(selection), true);
    } else {
      // regular click -> select only the clicked row, everything else get deselected
      this.setState(setSafe(this.state, ['lastSelected'], row.id));
      onSelectRows(tableId, Object.keys(rows), false);
      onSelectRows(tableId, [row.id], true);
    }
  };

  private renderRow(data: any, visibleAttributes: ITableAttribute[]): JSX.Element {
    const { t, rowActions, language, onChangeData, tableId, tableState } = this.props;
    return (
      <TableRow
        t={t}
        tableId={tableId}
        key={data.__id}
        data={data}
        attributes={visibleAttributes}
        actions={rowActions}
        language={language}
        onChangeData={onChangeData}
        onClick={this.selectRow}
        selected={getSafe(tableState.rows, [data.__id, 'selected'], false)}
      />
    );
  }

  private visibleAttributes(attributes: ITableAttribute[],
                            attributeStates: { [id: string]: IAttributeState }): ITableAttribute[] {
    return attributes.filter((attribute: ITableAttribute) => {
      if (attribute.isDetail) {
        return false;
      } else if (!attributeStates.hasOwnProperty(attribute.id)) {
        return true;
      } else {
        return getSafe(attributeStates, [attribute.id, 'enabled'], true);
      }
    });
  }

  private renderHeaderField = (attribute: ITableAttribute): JSX.Element => {
    const { t, tableState } = this.props;

    if (getSafe(tableState, [attribute.id, 'enabled'], true)) {
      return (
        <HeaderCell
          key={attribute.id}
          attribute={attribute}
          state={tableState.attributes[attribute.id]}
          onSetSortDirection={ this.setSortDirection }
          t={t}
        />
      );
    } else {
      return null;
    }
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { onSetAttributeSort, tableId, tableState } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (let testId of Object.keys(tableState)) {
      if ((id !== testId) && (tableState[testId].sortDirection !== 'none')) {
        onSetAttributeSort(tableId, testId, 'none');
      }
    }

    onSetAttributeSort(tableId, id, direction);
  }
}

function mapStateToProps(state: any, ownProps: IBaseProps): IConnectedProps {
  return {
    tableState: state.persistent.tables[ownProps.tableId],
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
