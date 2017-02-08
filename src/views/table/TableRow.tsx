import {ITableAttribute} from '../../types/ITableAttribute';

import IconBar from '../IconBar';
import {ITableRowAction} from '../Table';
import {IconButton} from '../TooltipControls';

import * as React from 'react';

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  rowData: any;
  t: I18next.TranslationFunction;
}

class TableCell extends React.Component<ICellProps, {}> {
  public render(): JSX.Element {
    const { t, attribute, language, rowData, rowId } = this.props;

    // if a custom renderer was set then rowData is the raw object
    // passed to the table by the user.
    // otherwise rowData is the calculated value of this cell

    if (attribute.customRenderer !== undefined) {
      return attribute.customRenderer(rowData, false, t);
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
    attribute.edit.onChangeValue(rowId, !value);
  }
}

export interface IRowProps {
  t: I18next.TranslationFunction;
  tableId: string;
  key: string;
  data: any;
  rowColor: string;
  rawData: any;
  attributes: ITableAttribute[];
  actions: ITableRowAction[];
  language: string;
  onClick: React.MouseEventHandler<any>;
  selected: boolean;
}

class TableRow extends React.Component<IRowProps, {}> {

  public shouldComponentUpdate(nextProps: IRowProps) {
    return (this.props.data !== nextProps.data)
      || (this.props.rawData !== nextProps.rawData)
      || (this.props.selected !== nextProps.selected)
      || (this.props.attributes !== nextProps.attributes);
  }

  public render(): JSX.Element {
    const { attributes, data, onClick, rawData, tableId, actions } = this.props;

    let classes = [];
    classes.push(rawData.rowColor !== '#ffffff' ?
     'table-selected-' + rawData.rowColor.Replace('#', '') : 'table-selected');

    let hasActions = false;
    if (actions !== undefined) {
      const rowActions = actions.filter((action) =>
        action.singleRowAction === undefined || action.singleRowAction);
      hasActions = rowActions.length > 0;
    }

    return (
      <tr
        id={data.__id}
        key={data.__id}
        className={classes.join(' ')}
        onClick={onClick}
      >
        {attributes.map(this.renderAttribute)}
        {
          hasActions
            ? <td style={{ textAlign: 'center' }}>
              <IconBar
                group={`${tableId}-action-icons`}
                instanceId={data.__id}
                className='table-actions'
                staticElements={actions}
              />
            </td>
            : null
        }
      </tr>
    );
  }

  private renderAttribute = (attribute: ITableAttribute): JSX.Element => {
    const { t, data, rawData, tableId } = this.props;
    return (
      <td
        className={`table-${tableId} cell-${attribute.id}`}
        key={attribute.id}
      >
        {this.renderCell(attribute, attribute.customRenderer ? rawData : data[attribute.id], t)}
      </td>
    );
  }

  private renderCell(
    attribute: ITableAttribute,
    rowData: any,
    t: I18next.TranslationFunction): JSX.Element {

    const { data, language } = this.props;

    return <TableCell
      t={t}
      attribute={attribute}
      rowData={rowData}
      rowId={data.__id}
      language={language}
    />;
  }
}

export default TableRow;
