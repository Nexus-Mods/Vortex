import {IEditChoice, ITableAttribute} from '../../types/ITableAttribute';

import FormFeedback from '../FormFeedbackAwesome';

import {ComponentEx} from '../../util/ComponentEx';
import * as _ from 'lodash';
import * as React from 'react';
import update = require('react-addons-update');
import {Button, ControlLabel, FormControl, FormGroup} from 'react-bootstrap';

import {log} from '../../util/log';

interface ICellProps {
  language: string;
  attribute: ITableAttribute;
  rowId: string;
  rowData: any;
  t: I18next.TranslationFunction;
  onChangeData: (rowId: string, attributeId: string, value: any) => void;
}

class DetailCell extends React.Component<ICellProps, {}> {
  public render(): JSX.Element {
    const { t, attribute, rowData, rowId } = this.props;
    const value = rowData[attribute.id];

    let content: JSX.Element = null;

    if (attribute.customRenderer !== undefined) {
      content = (
        <FormControl.Static>
          { attribute.customRenderer(rowData, true, t) }
        </FormControl.Static>
      );
    } else {
      if (attribute.edit.onChangeValue !== undefined) {
        if (attribute.edit.choices !== undefined) {
          const choices = attribute.edit.choices();
          const currentChoice = choices.find((choice) => choice.text === value);
          const key = currentChoice !== undefined ? currentChoice.key : undefined;
          content = (
            <FormControl
              id={attribute.id}
              componentClass='select'
              placeholder={t('No category')}
              value={key}
              onChange={this.changeCell}
            >
              {choices.map(this.renderChoice)}
            </FormControl>
          );
        } else if (attribute.edit.validate !== undefined) {
        content = (
          <FormGroup
            validationState={attribute.edit.validate(value)}
          >
            <FormControl
              id={attribute.id}
              type='text'
              label={t(attribute.name)}
              readOnly={false}
              value={this.renderCell(value)}
              onChange={this.changeCell}
            />
            <FormFeedback />
          </FormGroup>
          );
        } else {
          content = (
            <FormControl
              id={attribute.id}
              type='text'
              label={t(attribute.name)}
              readOnly={false}
              value={this.renderCell(value)}
              onChange={this.changeCell}
            />
          );
        }
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

    return (
      <FormGroup key={key}>
        <ControlLabel>{attribute.name}</ControlLabel>
        {content}
      </FormGroup>
    );
  }

  private changeCell = (evt: React.FormEvent<any>) => {
    const { attribute, onChangeData, rowId } = this.props;
    onChangeData(rowId, attribute.id, evt.currentTarget.value);
  }

  private renderChoice(choice: IEditChoice): JSX.Element {
    return <option key={choice.key} value={choice.key}>{choice.text}</option>;
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

interface IDetailProps {
  language: string;
  rowId: string;
  rowData: any;
  attributes: ITableAttribute[];
  t: I18next.TranslationFunction;
}

interface IDetailState {
  tempData: any;
  modified: boolean;
}

class DetailBox extends ComponentEx<IDetailProps, IDetailState> {
  constructor(props: IDetailProps) {
    super(props);

    this.initState({
      tempData: Object.assign({}, props.rowData),
      modified: false,
    });
  }

  public componentWillReceiveProps(nextProps: IDetailProps) {
    // TODO this looses all changes the user has made. Maybe give him a chance
    //   to apply first?
    this.nextState.tempData = Object.assign({}, nextProps.rowData);
    this.nextState.modified = false;
  }

  public render(): JSX.Element {
    const { t, attributes } = this.props;
    const { modified, tempData } = this.state;
    return (
      <form style={{ minWidth: 300 }}>
      {attributes.map((obj) => this.renderDetail(tempData, obj))}
      <Button disabled={!modified} onClick={this.reset}>{t('Reset')}</Button>
      <Button disabled={!modified} onClick={this.apply}>{t('Apply')}</Button>
      </form>
    );
  }

  private renderDetail = (rowData: any, attribute: ITableAttribute) => {
    const { t, language } = this.props;

    return <DetailCell
      t={t}
      key={`detail-${rowData.__id}-${attribute.id}`}
      attribute={attribute}
      language={language}
      rowData={rowData}
      rowId={rowData.__id}
      onChangeData={this.onChangeData}
    />;
  }

  private onChangeData = (rowId: string, attributeId: string, value: any) => {
    const oldData = this.props.rowData;
    const newData = this.state.tempData;

    this.nextState.tempData[attributeId] = value;
    this.nextState.modified = Object.keys(newData).find(
      (key: string) => oldData[key] !== newData[key]) !== undefined;
  }

  private reset = () => {
    this.nextState.tempData = Object.assign({}, this.props.rowData);
    this.nextState.modified = false;
  }

  private apply = () => {
    const { attributes, rowId } = this.props;
    const oldData = this.props.rowData;
    const newData = this.state.tempData;

    Object.keys(newData).forEach((key) => {
      if (oldData[key] !== newData[key]) {
        attributes
          .find((attribute: ITableAttribute) => attribute.id === key)
          .edit.onChangeValue(rowId, newData[key]);
      }
    });
  }
}

export default DetailBox;
