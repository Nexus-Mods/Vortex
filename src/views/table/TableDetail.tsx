import {IEditChoice, ITableAttribute} from '../../types/ITableAttribute';
import {PureComponentEx} from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';

import ExtensionGate from '../ExtensionGate';
import FormFeedback from '../FormFeedbackAwesome';
import FormInput from '../FormInput';
import Icon from '../Icon';
import More from '../More';

import * as _ from 'lodash';
import * as React from 'react';
import { Button, ControlLabel, FormControl, FormGroup,
         ListGroup, ListGroupItem } from 'react-bootstrap';

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  rowData: any;
  rawData: any;
  t: I18next.TranslationFunction;
  onChangeData: (rowId: string, attributeId: string, value: any) => void;
}

class DetailCell extends React.Component<ICellProps, {}> {
  public shouldComponentUpdate(nextProps: ICellProps) {
    return this.props.language !== nextProps.language
      || this.props.rowData[this.props.attribute.id] !== nextProps.rowData[nextProps.attribute.id];
  }

  public render(): JSX.Element {
    const { t, attribute, rawData, rowData, rowId } = this.props;
    const value = rowData[attribute.id];

    let content: JSX.Element = null;

    if (attribute.customRenderer !== undefined) {
      const attrControl = attribute.customRenderer(rawData, true, t);
      content = (
        <FormControl.Static componentClass='div'>
          {
            attrControl !== null ? (
              <ExtensionGate id={`extension-${rowId}-${attribute.id}`}>
                {attrControl}
              </ExtensionGate>
            ) : null
          }
        </FormControl.Static>
      );
    } else {
      const readOnly = getSafe(attribute, ['edit', 'readOnly'], (val: any) => false)(rawData);
      if (attribute.edit.onChangeValue !== undefined) {
        if (attribute.edit.choices !== undefined) {
          const choices = attribute.edit.choices();
          const currentChoice = choices.find(choice => choice.text === value);
          const key = currentChoice !== undefined ? currentChoice.key : undefined;
          if (readOnly) {
            content = (
              <FormControl.Static>
                {currentChoice !== undefined ? currentChoice.text : null}
              </FormControl.Static>
            );
          } else {
            content = (
              <FormControl
                id={attribute.id}
                componentClass='select'
                value={key}
                onChange={this.changeCellEvt}
              >
                {choices.map(this.renderChoice)}
              </FormControl>
            );
          }
        } else if (attribute.edit.validate !== undefined) {
          content = (
            <FormGroup
              validationState={attribute.edit.validate(value)}
            >
              <FormInput
                id={attribute.id}
                label={t(attribute.name)}
                value={this.renderCell(value)}
                onChange={this.changeCell}
                readOnly={readOnly}
              />
              { readOnly ? null : <FormFeedback /> }
            </FormGroup>
          );
        } else {
          content = (
            <FormInput
              id={attribute.id}
              label={t(attribute.name)}
              readOnly={readOnly}
              value={this.renderCell(value)}
              onChange={this.changeCell}
            />
          );
        }
      } else if (Array.isArray(value)) {
        let idx = 0;
        content = (
          <ListGroup>
            {value.map((val: any) =>
                <ListGroupItem key={`${attribute.id}-${idx++}`}>{val}</ListGroupItem>)}
          </ListGroup>
        );
      } else {
        content = (
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

    const key = `${rowId}-${attribute.id}`;

    const helpIcon = attribute.help !== undefined
      ? (
        <More id={`more-tableattribute-${attribute.id}`} name={attribute.name}>
          { attribute.help }
        </More>
      ) : null;

    return (
      <FormGroup key={key}>
        { attribute.name !== undefined ? (
          <ControlLabel>{attribute.name} {helpIcon}</ControlLabel>
         ) : null }
        {content}
      </FormGroup>
    );
  }

  private changeCell = (newValue: string) => {
    const { attribute, onChangeData, rowId } = this.props;
    onChangeData(rowId, attribute.id, newValue);
  }

  private changeCellEvt = (evt: React.FormEvent<any>) => {
    this.changeCell(evt.currentTarget.value);
  }

  private renderChoice(choice: IEditChoice): JSX.Element {
    return <option key={choice.key || 'undefined'} value={choice.key}>{choice.text}</option>;
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
  rowId: string;
  rowData: any;
  rawData: any;
  attributes: ITableAttribute[];
  t: I18next.TranslationFunction;
  show: boolean;
  onToggleShow: () => void;
}

class DetailBox extends PureComponentEx<IDetailProps, {}> {
  constructor(props: IDetailProps) {
    super(props);
  }

  public shouldComponentUpdate(nextProps: IDetailProps) {
    return (this.props.rowId !== nextProps.rowId)
      || (this.props.language !== nextProps.language)
      || (this.props.rawData !== nextProps.rawData)
      || (this.props.rowData !== nextProps.rowData)
      || (this.props.show !== nextProps.show)
      || !_.isEqual(this.props.attributes, nextProps.attributes);
  }

  public render(): JSX.Element {
    const { attributes, onToggleShow, show, rowData } = this.props;
    return (
      <div style={{ height: '100%', position: 'relative', display: 'flex', overflowX: 'hidden' }}>
        {show ? null : this.renderHandle() }
        <div style={{ display: 'flex' }} >
          <form style={{ flex: '1 1 0%', overflowY: show ? 'auto' : 'hidden' }}>
            {attributes
              .filter(obj => rowData[obj.id] !== undefined)
              .map(obj => this.renderDetail(obj))}
          </form>
          <Button
            id='btn-minimize-menu'
            onClick={onToggleShow}
            className='btn-menu-minimize'
          >
            <Icon name={show ? 'angle-double-right' : 'angle-double-left'} />
          </Button>
        </div>
      </div>
    );
  }

  private renderHandle(): JSX.Element {
    const { t, onToggleShow } = this.props;
    const style = {
      border: '1px solid #0c5886',
      height: '100%',
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
      <Button style={style}
        onClick={onToggleShow}
      >
        <div style={textStyle}><Icon name='bold-up' />{t('Mod Attributes')}</div>
      </Button>
    );
  }

  private renderDetail = (attribute: ITableAttribute) => {
    const { t, language, rawData, rowData } = this.props;

    return (
      <DetailCell
        t={t}
        key={`detail-${rowData.__id}-${attribute.id}`}
        attribute={attribute}
        language={language}
        rowData={rowData}
        rawData={rawData}
        rowId={rowData.__id}
        onChangeData={this.onChangeData}
      />
    );
  }

  private onChangeData = (rowId: string, attributeId: string, value: any) => {
    this.props.attributes
    .find((attr: ITableAttribute) => attr.id === attributeId)
    .edit.onChangeValue(rowId, value);
  }
}

export default DetailBox;
