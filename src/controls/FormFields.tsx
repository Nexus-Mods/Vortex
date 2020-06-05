import FormFeedback from './FormFeedback';
import { IconButton } from './TooltipControls';

import { remote } from 'electron';
import { TFunction } from 'i18next';
import * as React from 'react';
import { Checkbox, Col, ControlLabel,
         FormControl, FormGroup,
         InputGroup } from 'react-bootstrap';

export interface IFormItemProps {
  t: TFunction;
  controlId: string;
  label: string;
  placeholder?: string;
  stateKey: string;
  value: any;
  onChangeValue?: (key: string, newValue: any) => void;
  validator?: (value: string) => string;
  readOnly?: boolean;
  maxLength?: number;
  style?: React.CSSProperties;
}

export class FormTextItem extends React.Component<IFormItemProps, {}> {
  public render() {
    const { controlId, label, maxLength, placeholder, readOnly, style, value } = this.props;

    const validation = value !== undefined ? this.validationState() : undefined;
    const validationState = validation === undefined
      ? undefined : validation === null
      ? 'success'
      : 'error';

    return (
      <FormGroup
        controlId={controlId}
        validationState={validationState}
        style={style}
      >
        <Col componentClass={ControlLabel} sm={3}>
          {label}
        </Col>
        <Col sm={9}>
          <FormControl
            type='text'
            placeholder={placeholder}
            value={value || ''}
            onChange={this.onChangeValue}
            readOnly={readOnly}
            maxLength={maxLength}
          />
          {validation ? <ControlLabel>{validation}</ControlLabel> : null}
        </Col>
        <FormFeedback />
      </FormGroup>
      );
  }

  private validationState() {
    const { validator, value } = this.props;
    if (validator === undefined) {
      return undefined;
    }
    return validator(value);
  }

  private onChangeValue = (evt) => {
    const { stateKey, onChangeValue } = this.props;
    onChangeValue(stateKey, evt.currentTarget.value);
  }
}

export class FormCheckboxItem extends React.Component<IFormItemProps, {}> {
  public render() {
    const { label, style, value } = this.props;
    return (
      <Checkbox value={value} onChange={this.onChangeValue} style={style}>
        {label}
      </Checkbox>
      );
  }
  private onChangeValue = (evt) => {
    const { stateKey, onChangeValue } = this.props;
    if (onChangeValue !== undefined) {
      onChangeValue(stateKey, evt.currentTarget.value);
    }
  }
}

export interface IFormPathProps extends IFormItemProps {
  directory: boolean;
  extensions?: string[];
}

export class FormPathItem extends React.Component<IFormPathProps, {}> {
  public render(): JSX.Element {
    const { t, controlId, label, placeholder, readOnly, style, value } = this.props;

    const validation = value !== undefined ? this.validationState() : undefined;
    const validationState = validation === undefined
      ? undefined : validation === null
      ? 'success'
      : 'error';

    return (
      <FormGroup controlId={controlId} validationState={validationState} style={style}>
        <Col componentClass={ControlLabel} sm={3}>
          {label}
        </Col>
        <Col sm={9}>
          <InputGroup>
            <FormControl
              type='text'
              value={value}
              placeholder={placeholder}
              readOnly={readOnly}
              onChange={this.handleTypePath}
            />
            {readOnly ? null : (
              <InputGroup.Button className='inset-btn'>
                <IconButton
                  id='change-tool-path'
                  tooltip={t('Change')}
                  onClick={this.handleChangePath}
                  icon='browse'
                />
              </InputGroup.Button>
            )}
          </InputGroup>
          {validation ? <ControlLabel>{validation}</ControlLabel> : null}
        </Col>
      </FormGroup>
      );
  }

  private validationState() {
    const { validator, value } = this.props;
    if (validator === undefined) {
      return undefined;
    }
    return validator(value);
  }

  private handleTypePath = (evt: any) => {
    const { onChangeValue, stateKey } = this.props;
    onChangeValue(stateKey, evt.target.value);
  }

  private handleChangePath = () => {
    const {directory, extensions, onChangeValue, stateKey, value} = this.props;
    remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
      defaultPath: value,
      properties: [ directory ? 'openDirectory' : 'openFile' ],
      filters: extensions !== undefined ? [
        { name: 'Files', extensions },
      ] : [],
    }).then(result => {
      const { filePaths } = result;
      if ((filePaths !== undefined) && (filePaths.length > 0)) {
        onChangeValue(stateKey, filePaths[0]);
      }
    });
  }
}
