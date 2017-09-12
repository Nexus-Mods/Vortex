import {IEditChoice, ITableAttribute} from '../../types/ITableAttribute';
import {PureComponentEx} from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';

import ExtensionGate from '../ExtensionGate';
import FormFeedback from '../FormFeedback';
import FormInput from '../FormInput';
import Icon from '../Icon';
import More from '../More';

import * as I18next from 'i18next';
import * as _ from 'lodash';
import * as React from 'react';
import { Button, ControlLabel, FormControl, FormGroup,
         ListGroup, ListGroupItem } from 'react-bootstrap';
import * as Select from 'react-select';

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowIds: string[];
  rowData: { [rowId: string]: any };
  rawData: { [rowId: string]: any };
  t: I18next.TranslationFunction;
  onChangeData: (rowIds: string[], attributeId: string, value: any) => void;
}

class ValueComponent extends React.Component<any, {}> {
  public render() {
    return (
      <div className='Select-value' title={this.props.value.text}>
        <span className='Select-value-label' role='option'>
          {this.props.value.text}
        </span>
      </div>
    );
  }
}

class DetailCell extends React.Component<ICellProps, {}> {
  public shouldComponentUpdate(nextProps: ICellProps) {
    if (this.props.language !== nextProps.language) {
      return true;
    }

    if (this.props.rowIds !== nextProps.rowIds) {
      return true;
    }

    nextProps.rowIds.forEach(rowId => {
      if (this.props.rowData[rowId] !== nextProps.rowData[rowId]) {
        return true;
      }
    });
    if ((this.props.rowData !== nextProps.rowData)
        || (this.props.rawData !== nextProps.rawData)) {
      return true;
    }
    return false;
  }

  public render(): JSX.Element {
    const { t, attribute, rawData, rowData, rowIds } = this.props;

    let content: JSX.Element = null;

    if (attribute.customRenderer !== undefined) {
      const values = rowIds.map(id => rawData[id]);
      if ((values.length === 0) || (values[0] === undefined)) {
        return null;
      }
      const attrControl = attribute.customRenderer(
        attribute.supportsMultiple ? values : values[0], true, t);
      content = attrControl !== null ? (
        <FormControl.Static componentClass='div'>
          {
            (
              <ExtensionGate id={`extension-${rowIds[0]}-${attribute.id}`}>
                {attrControl}
              </ExtensionGate>
            )
          }
        </FormControl.Static>
      ) : null;
    } else {
      const values = rowIds.map(id => rowData[id][attribute.id]);
      const readOnly = getSafe(attribute, ['edit', 'readOnly'], (val: any) => false)(rawData);

      if (attribute.edit.onChangeValue !== undefined) {
        content = (attribute.edit.choices !== undefined)
          ? this.renderSelect(values, readOnly)
          : (attribute.edit.validate !== undefined)
            ? this.renderValidation(values, readOnly)
            : this.renderInput(values, readOnly);
      } else {
        content = this.renderRO(values);
      }
    }

    const key = `${rowIds[0]}-${attribute.id}`;

    const helpIcon = attribute.help !== undefined
      ? (
        <More id={`more-tableattribute-${attribute.id}`} name={attribute.name}>
          {attribute.help}
        </More>
      ) : null;

    return content !== null ? (
      <FormGroup key={key}>
        { attribute.name !== undefined ? (
          <ControlLabel>{attribute.name}{helpIcon}</ControlLabel>
         ) : null }
        {content}
      </FormGroup>
    ) : null;
  }

  private renderSelect(values: any[], readOnly: boolean): JSX.Element {
    const { t, attribute, rowIds } = this.props;

    const various = values.find(iter => iter !== values[0]) !== undefined;

    const choices = attribute.edit.choices();
    let currentChoice: IEditChoice;
    if (!various) {
      currentChoice = choices.find(choice => choice.text === values[0]);
    }
    if (readOnly) {
      return (
        <FormControl.Static>
          {currentChoice !== undefined ? currentChoice.text : null}
        </FormControl.Static>
      );
    } else {
      const choiceKey = currentChoice !== undefined ? currentChoice.key : undefined;
      return (
        <Select
          options={choices}
          value={choiceKey}
          onChange={this.changeCellSelect}
          valueKey='key'
          labelKey='text'
          valueComponent={ValueComponent}
        />
      );
    }
  }

  private renderValidation(values: any[], readOnly: boolean): JSX.Element {
    const { t, attribute } = this.props;

    const various = values.find(iter => iter !== values[0]) !== undefined;

    const validationState = various
      ? 'warning'
      : attribute.edit.validate(values[0]);

    return (
      <FormGroup
        validationState={validationState}
      >
        <FormInput
          id={attribute.id}
          label={t(attribute.name)}
          value={various ? t('Various') : this.renderCell(values[0])}
          onChange={this.changeCell}
          readOnly={readOnly}
        />
        {readOnly ? null : <FormFeedback />}
      </FormGroup>
    );
  }

  private renderInput(values: any[], readOnly: boolean): JSX.Element {
    const { t, attribute } = this.props;

    const various = values.find(iter => iter !== values[0]) !== undefined;

    return (
      <FormInput
        id={attribute.id}
        label={t(attribute.name)}
        readOnly={readOnly}
        value={various ? '' : this.renderCell(values[0])}
        onChange={this.changeCell}
        placeholder={various ? t('Various') : ''}
      />
    );
  }

  private renderRO(values: any[]): JSX.Element {
    const { t, attribute } = this.props;

    const various = values.find(iter => iter !== values[0]) !== undefined;
    const value = various ? t('Various') : values[0];

    if (Array.isArray(value)) {
      let idx = 0;
      return (
        <ListGroup>
          {value.map((val: any) =>
            <ListGroupItem key={`${attribute.id}-${idx++}`}>{val}</ListGroupItem>)}
        </ListGroup>
      );
    } else {
      return (
        <FormControl
          id={attribute.id}
          type='text'
          label={t(attribute.name)}
          readOnly={true}
          value={this.renderCell(value)}
        />
      );
    }
  }

  private changeCell = (newValue: string) => {
    const { attribute, onChangeData, rowIds } = this.props;
    onChangeData(rowIds, attribute.id, newValue);
  }

  private changeCellEvt = (evt: React.FormEvent<any>) => {
    this.changeCell(evt.currentTarget.value);
  }

  private changeCellSelect = (value: any) => {
    if (value !== null) {
      this.changeCell(value.key);
    } else {
      this.changeCell(undefined);
    }
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

export interface IDetailProps {
  language: string;
  rowIds: string[];
  rowData: { [rowId: string]: any };
  rawData: { [rowId: string]: any };
  attributes: ITableAttribute[];
  t: I18next.TranslationFunction;
  show: boolean;
  title: string;
  onToggleShow: () => void;
}

class DetailBox extends PureComponentEx<IDetailProps, {}> {
  constructor(props: IDetailProps) {
    super(props);
  }

  public shouldComponentUpdate(nextProps: IDetailProps) {
    // TODO: when data changes it will almost always cause an update in rawData and
    //   then a delayed update to rowData, so this component gets updated twice for
    //   one change in row data
    return (this.props.rowIds !== nextProps.rowIds)
      || (this.props.language !== nextProps.language)
      || (this.props.rawData !== nextProps.rawData)
      || (this.props.rowData !== nextProps.rowData)
      || (this.props.show !== nextProps.show)
      || !_.isEqual(this.props.attributes, nextProps.attributes);
  }

  public render(): JSX.Element {
    const { t, attributes, onToggleShow, rowData, rowIds, show } = this.props;

    const detailList = attributes
      .filter(obj =>
        (rowData[rowIds[0]][obj.id] !== undefined)
        && ((rowIds.length === 1)
          || obj.supportsMultiple));

    const visClass = (show ? 'table-form-details-show' : 'table-form-details-hide');
    return (
      <div style={{ height: '100%', position: 'relative', display: 'flex', overflowX: 'hidden' }}>
        {show ? null : this.renderHandle()}
        <div style={{ display: 'flex', flexDirection: 'column' }} >
          {detailList.length > 0 ? (
            <form className={'table-form-details ' + visClass}>
              {detailList.map(obj => this.renderDetail(obj))}
            </form>
          ) : (
            <h4 style={{ marginTop: 'auto', marginBottom: 'auto', padding: 5 }}>
              {t('Multiple items selected')}
            </h4>
          )
          }
          <Button
            id='btn-minimize-menu'
            onClick={onToggleShow}
            className='btn-menu-minimize'
          >
            <Icon name={show ? 'right' : 'left'} />
          </Button>
        </div>
      </div>
    );
  }

  private renderHandle(): JSX.Element {
    const { t, title, onToggleShow } = this.props;
    const style = {
      border: '1px solid #0c5886',
      position: 'relative' as 'relative',
    };
    const textStyle = {
      transform: 'rotate(-90deg)',
      transformOrigin: 'left',
      position: 'absolute' as 'absolute',
      whiteSpace: 'nowrap',
      top: '50%',
      left: '50%',
    };

    return (
      <Button
        style={style}
        onClick={onToggleShow}
      >
        <div style={textStyle}><Icon name='up' />{' '}{title || t('Details')}</div>
      </Button>
    );
  }

  private renderDetail = (attribute: ITableAttribute) => {
    const { t, language, rawData, rowData, rowIds } = this.props;

    return (
      <DetailCell
        t={t}
        key={`detail-${rowIds[0]}-${attribute.id}`}
        attribute={attribute}
        language={language}
        rowData={rowData}
        rawData={rawData}
        rowIds={rowIds}
        onChangeData={this.onChangeData}
      />
    );
  }

  private onChangeData = (rowIds: string[], attributeId: string, value: any) => {
    const attribute = this.props.attributes
    .find((attr: ITableAttribute) => attr.id === attributeId);
    if (attribute.supportsMultiple === true) {
      attribute.edit.onChangeValue(rowIds, value);
    } else if (rowIds.length === 1) {
      attribute.edit.onChangeValue(rowIds[0], value);
    }
  }
}

export default DetailBox;
