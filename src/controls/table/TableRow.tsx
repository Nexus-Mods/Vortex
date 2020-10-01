import { IEditChoice, ITableAttribute } from '../../types/ITableAttribute';
import { TFunction } from '../../util/i18n';

import ContextMenu from '../ActionContextMenu';
import ActionDropdown from '../ActionDropdown';
import Dropdown, { DummyMenu } from '../Dropdown';
import ExtensionGate from '../ExtensionGate';
import Icon from '../Icon';
import {ITableRowAction} from '../Table';
import {Button, IconButton} from '../TooltipControls';
import VisibilityProxy from '../VisibilityProxy';

import { TD, TR } from './MyTable';

import * as _ from 'lodash';
import * as React from 'react';
import { MenuItem } from 'react-bootstrap';
import Select from 'react-select';

const ValueComponent = (props) => (
  <div className='Select-value' title={props.value.text}>
    <span className='Select-value-label' role='option'>
      {props.value.text}
    </span>
  </div>
);

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  data: any;
  rawData: any;
  tableId: string;
  t: TFunction;
  container: HTMLElement;
  onHighlight: (highlight: boolean) => void;
  right: boolean;
}

class TableCell extends React.Component<ICellProps, { isOpen: boolean }> {
  constructor(props: ICellProps) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  public shouldComponentUpdate(newProps: ICellProps, newState: { isOpen: boolean }) {
    return ((newProps.attribute.customRenderer !== undefined)
            && (this.props.rawData !== newProps.rawData))
        || this.props.data !== newProps.data
        || this.props.language !== newProps.language
        || this.state.isOpen !== newState.isOpen;
  }

  public render(): JSX.Element {
    const { t, attribute, data, language, onHighlight,
            rawData, rowId } = this.props;

    // if a custom renderer was set then rowData is the raw object
    // passed to the table by the user.
    // otherwise rowData is the calculated value of this cell

    if (attribute.customRenderer !== undefined) {
      const attrControl = attribute.customRenderer(rawData, false, t, {
        onHighlight }) || null;
      return attrControl !== null ? (
        <ExtensionGate id={`extension-${rowId}-${attribute.id}`}>
          {attrControl}
        </ExtensionGate>
      ) : null;
    }

    if ((data === undefined) || (data === null)) {
      return <span>{' '}</span>;
    } else if ((attribute.edit.onChangeValue !== undefined) && attribute.edit.inline) {
      if (attribute.edit.choices !== undefined) {
        return this.renderChoices(data);
      }
    } else {
      const cellType = typeof(data);
      if (cellType === 'string') {
        return <span>{data}</span>;
      } else if (cellType === 'boolean') {
        return (
          <IconButton
            className='btn-embed'
            id={`toggle-${rowId}-${attribute.id}`}
            tooltip={attribute.name}
            icon={data ? 'checkbox-checked' : 'square-remove'}
            onClick={this.toggle}
          />
        );
      } else if ((cellType === 'object') && (data instanceof Date)) {
        return (
          <span>
            {data !== undefined ? data.toLocaleString(language) : t('Not installed')}
          </span>
        );
      }
    }
    return <span>{data.toString()}</span>;
  }

  private renderChoices(data: any): JSX.Element {
    const { attribute } = this.props;
    if (attribute.edit.actions !== false) {
      return this.renderAction(data);
    } else {
      return this.renderSelect(data);
    }
  }

  private renderAction(data: any): JSX.Element {
    const { t, attribute, container, right, tableId } = this.props;

    const choices = attribute.edit.choices();
    const currentChoice = choices.find(choice => choice.text === data);
    const key = currentChoice !== undefined ? currentChoice.key : undefined;
    return (
      <Dropdown
        id={`dropdown-${tableId}-${attribute.id}`}
        container={container}
        pullRight={right}
        onToggle={this.openChoice}
      >
        <Button
          id={`btn-${tableId}-${attribute.id}`}
          className={`btn-${tableId}-${attribute.id}-${key} dropdown-title`}
          key={key}
          onClick={this.cycle}
          onSelect={this.changeCell}
          tooltip={attribute.description}
        >
          {((currentChoice !== undefined) && (currentChoice.icon !== undefined))
            ? <Icon name={currentChoice.icon} /> : null}
          {currentChoice !== undefined ? t(currentChoice.text) : ''}
        </Button>
        <Dropdown.Toggle
          className={`toggle-${tableId}-${attribute.id} `
            + `toggle-${tableId}-${attribute.id}-${key}`}
        />
        {this.state.isOpen
          ? (
            <Dropdown.Menu
              onSelect={this.changeCell}
            >
              {choices.filter(choice => choice.visible !== false).map(this.renderChoice)}
            </Dropdown.Menu>
          )
          : <DummyMenu />}
      </Dropdown>
    );
  }

  private renderSelect(data: any): JSX.Element {
    const { t, attribute } = this.props;

    const choices = attribute.edit.choices();

    const currentChoice: IEditChoice = choices.find(choice => choice.text === data);

    const choiceKey = currentChoice !== undefined ? currentChoice.key : undefined;
    return (
      <Select
        options={choices}
        value={choiceKey}
        onChange={this.changeCellSelect}
        valueKey='key'
        labelKey='text'
        valueComponent={ValueComponent}
        clearable={false}
        searchable={false}
      />
    );
  }

  private cycle = () => {
    const { attribute, rawData } = this.props;
    attribute.edit.onChangeValue(rawData, undefined);
  }

  private changeCell = (key) => {
    const { attribute, rawData } = this.props;
    attribute.edit.onChangeValue(rawData, key);
  }

  private changeCellSelect = (value: any) => {
    if (value !== null) {
      this.changeCell(value.key);
    } else {
      this.changeCell(undefined);
    }
  }

  private openChoice = (isOpen: boolean) => {
    this.setState({ isOpen });
  }

  private renderChoice = (choice: IEditChoice): JSX.Element => {
    const { t, attribute, tableId } = this.props;
    return (
      <MenuItem
        eventKey={choice.key}
        key={choice.key}
        className={`option-${tableId}-${attribute.id}-${choice.key}`}
      >
        {choice.icon ? <Icon name={choice.icon} /> : null}
        {t(choice.text)}
      </MenuItem>
    );
  }

  private toggle = () => {
    const { attribute, data, rawData } = this.props;
    const value = data;
    attribute.edit.onChangeValue(rawData, !value);
  }
}

export interface IRowProps {
  t: TFunction;
  id: string;
  tableId: string;
  rowClass: string;
  data: any;
  rawData: any;
  attributes: ITableAttribute[];
  inlines: ITableAttribute[];
  sortAttribute: string;
  actions: ITableRowAction[];
  hasActions: boolean;
  language: string;
  onClick: React.MouseEventHandler<any>;
  selected: boolean;
  highlighted: boolean;
  domRef?: (ref) => void;
  container: HTMLElement;
  visible: boolean;
  grouped: boolean;
  group: string;
  onSetVisible: (rowId: string, visible: boolean) => void;
  onHighlight: (rowId: string, highlight: boolean) => void;
}

interface IRowState {
  contextVisible: boolean;
  context?: { x: number, y: number };
}

class TableRow extends React.Component<IRowProps, IRowState> {
  constructor(props: IRowProps) {
    super(props);
    this.state = {
      contextVisible: false,
      context: undefined,
    };
  }

  public shouldComponentUpdate(nextProps: IRowProps, nextState: IRowState) {
    // don't redraw if _just_ rawdata changed because the calculated data should always update
    // too (with a delay) so updating on both events would cause two updates for every data change
    return (this.props.visible !== nextProps.visible)
      || (this.props.data !== nextProps.data)
      || (this.props.selected !== nextProps.selected)
      || (this.props.grouped !== nextProps.grouped)
      || (this.props.highlighted !== nextProps.highlighted)
      || (this.props.attributes !== nextProps.attributes)
      || (this.state.contextVisible !== nextState.contextVisible)
      || (this.state.context !== nextState.context);
  }

  public render(): JSX.Element | JSX.Element[] {
    const { data, domRef, inlines, group, grouped, highlighted, id, onClick,
            rowClass, selected } = this.props;

    const classes = [
      rowClass,
    ];

    if (selected) {
      classes.push('table-selected');
    }
    if (highlighted) {
      classes.push('table-highlighted');
    }
    if (grouped) {
      classes.push('table-row-grouped');
    }

    const res = [(
      <VisibilityProxy
        id={id}
        componentClass={TR}
        data-rowid={data.__id}
        data-group={group}
        key={data.__id}
        className={classes.join(' ')}
        onClick={onClick}
        onContextMenu={this.onContext}
        ref={domRef}
        style={{ position: 'relative' }}

        visible={this.props.visible}
        setVisible={this.setVisible}
        container={this.props.container}
        placeholder={this.renderPlaceholder}
        content={this.renderRow}
      />
    )];

    if (this.props.visible) {
      inlines.forEach(extra => {
        res.push((
          <tr key={data.__id + '_extra_' + extra.id}>
            {this.renderAttributeExtra(extra)}
          </tr>
        ));
      });
    }

    return res;
  }

  private renderPlaceholder = (): React.ReactNode => {
    return (
      <TD>{'\u00A0'}</TD>
    );
  }

  private renderRow = (): React.ReactNode => {
    const { t, actions, attributes, data, hasActions, tableId } = this.props;

    const res = attributes.map(this.renderAttribute);
    const sorted = actions
      .filter(icon => {
        try {
          return (icon.condition === undefined)
            || icon.condition([data.__id]);
        } catch (err) {
          return false;
        }
      })
      .sort((lhs, rhs) => lhs.position - rhs.position);

    if (hasActions) {
      res.push((
        <TD
          style={{ textAlign: 'center' }}
          key='action-cell'
          className={`table-${tableId} cell-actions`}
        >
          <ContextMenu
            t={t}
            id={`${tableId}-${data.__id}-action-context`}
            group={`${tableId}-action-icons`}
            instanceId={data.__id}
            className='table-actions'
            staticElements={sorted}
            visible={this.state.contextVisible}
            position={this.state.context}
            onHide={this.onHideContext}
          />
          <ActionDropdown
            t={t}
            id={`${tableId}-${data.__id}-action-icons`}
            group={`${tableId}-action-icons`}
            instanceId={data.__id}
            className='table-actions'
            staticElements={actions}
          />
        </TD>
      ),
      );
    } else {
      res.push(<TD key='no-action' />);
    }
    return res;
  }

  private setVisible = (visible: boolean) => {
    // it may be that this visible value is the same as the one in props, but
    // since rows are turned invisible with a delay, it's possible a row becomes invisible
    // and visible again without the prop changing, so we have to call this anyway.
    this.props.onSetVisible(this.props.id, visible);
  }

  private renderAttribute = (attribute: ITableAttribute, index: number,
                             arr: ITableAttribute[]): JSX.Element => {
    const { t, data, rawData, sortAttribute, tableId } = this.props;
    const classes = [
      `table-${tableId}`,
      `cell-${attribute.id}`,
    ];

    if (attribute.id === sortAttribute) {
      classes.push('table-sort-column');
    }

    return (
      <TD
        className={classes.join(' ')}
        key={attribute.id}
      >
        {this.renderCell(attribute, rawData, data[attribute.id], t,
                         index >= (arr.length / 2))}
      </TD>
    );
  }

  private renderAttributeExtra = (attribute: ITableAttribute): JSX.Element => {
    const { t, attributes, data, hasActions, rawData, tableId } = this.props;
    const classes = [
      `table-${tableId}`,
      `cell-${attribute.id}`,
    ];

    return (
      <TD
        className={classes.join(' ')}
        key={attribute.id}
        colSpan={attributes.length + (hasActions ? 1 : 0)}
      >
        {this.renderCell(attribute, rawData, data[attribute.id], t, false)}
      </TD>
    );
  }

  private highlight = (highlight: boolean) => {
    const {data, onHighlight} = this.props;
    onHighlight(data.__id, highlight);
  }

  private renderCell(
    attribute: ITableAttribute,
    rawData: any,
    calculatedData: any,
    t: TFunction,
    right: boolean): JSX.Element {

    const { container, data, language, tableId } = this.props;

    return (
      <TableCell
        t={t}
        attribute={attribute}
        rawData={rawData}
        data={calculatedData}
        rowId={data.__id}
        tableId={tableId}
        language={language}
        container={container}
        onHighlight={this.highlight}
        right={right}
      />
    );
  }

  private onContext = (event: React.MouseEvent<any>) => {
    this.setState({ contextVisible: true, context: { x: event.clientX, y: event.clientY } });
  }

  private onHideContext = () => {
    this.setState({ contextVisible: false });
  }
}

export default TableRow as React.ComponentClass<IRowProps>;
