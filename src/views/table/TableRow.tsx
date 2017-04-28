import { IEditChoice, ITableAttribute } from '../../types/ITableAttribute';

import IconBar from '../IconBar';
import {ITableRowAction} from '../Table';
import {Button, IconButton} from '../TooltipControls';

import * as React from 'react';
import { Dropdown, FormControl, MenuItem, SplitButton } from 'react-bootstrap';

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  rowData: any;
  tableId: string;
  t: I18next.TranslationFunction;
}

class TableCell extends React.Component<ICellProps, {}> {
  public render(): JSX.Element {
    const { t, attribute, language, rowData, rowId, tableId } = this.props;

    // if a custom renderer was set then rowData is the raw object
    // passed to the table by the user.
    // otherwise rowData is the calculated value of this cell

    if (attribute.customRenderer !== undefined) {
      return attribute.customRenderer(rowData, false, t);
    }

    if ((rowData === undefined) || (rowData === null)) {
      return <span>{' '}</span>;
    } else if ((attribute.edit.onChangeValue !== undefined) && attribute.edit.inline) {
      if (attribute.edit.choices !== undefined) {
        const choices = attribute.edit.choices();
        const currentChoice = choices.find(choice => choice.text === rowData);
        const key = currentChoice !== undefined ? currentChoice.key : undefined;
        return (
          <Dropdown id={`dropdown-${tableId}-${attribute.id}`}>
            <Button
              id={`btn-${tableId}-${attribute.id}`}
              className={`btn-${tableId}-${attribute.id}-${key}`}
              key={key}
              onClick={this.cycle}
              onSelect={this.changeCell}
              tooltip={attribute.description}
            >
            {currentChoice !== undefined ? t(currentChoice.text) : ''}
            </Button>
            <Dropdown.Toggle
              className={`toggle-${tableId}-${attribute.id} `
                       + `toggle-${tableId}-${attribute.id}-${key}`}
            />
            <Dropdown.Menu
              onSelect={this.changeCell}
            >
            {choices.map(this.renderChoice)}
            </Dropdown.Menu>
          </Dropdown>
        );
      }
    } else {
      const cellType = typeof(rowData);
      if (cellType === 'string') {
        return <span>{rowData}</span>;
      } else if (cellType === 'boolean') {
        return (
          <IconButton
            className='btn-embed'
            id={`toggle-${rowId}-${attribute.id}`}
            tooltip={attribute.name}
            icon={rowData ? 'check-square-o' : 'square-o'}
            onClick={this.toggle}
          />
        );
      } else if ((cellType === 'object') && (rowData instanceof Date)) {
        return (
          <span>
            {rowData !== undefined ? rowData.toLocaleString(language) : t('Not installed')}
          </span>
        );
      }
    }
    return <span>{rowData.toString()}</span>;
  }

  private cycle = () => {
    const { attribute, rowId } = this.props;
    attribute.edit.onChangeValue(rowId, undefined);
  }

  private changeCell = (key) => {
    const { attribute, rowId } = this.props;
    attribute.edit.onChangeValue(rowId, key);
  }

  private renderChoice = (choice: IEditChoice): JSX.Element => {
    const { t, attribute, tableId } = this.props;
    return (
      <MenuItem
        eventKey={choice.key}
        key={choice.key}
        className={`option-${tableId}-${attribute.id}-${choice.key}`}
      >
        {t(choice.text)}
      </MenuItem>
    );
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
    const { attributes, data, onClick, selected, tableId, actions } = this.props;

    const classes = [];

    if (selected) {
      classes.push('table-selected');
    }

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
            ? (
              <td style={{ textAlign: 'center' }}>
                <IconBar
                  group={`${tableId}-action-icons`}
                  instanceId={data.__id}
                  className='table-actions'
                  staticElements={actions}
                />
              </td>
            ) : null
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

    const { data, language, tableId } = this.props;

    return (
      <TableCell
        t={t}
        attribute={attribute}
        rowData={rowData}
        rowId={data.__id}
        tableId={tableId}
        language={language}
      />
    );
  }
}

export default TableRow;
