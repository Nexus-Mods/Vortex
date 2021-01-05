import { ValidationState } from '../types/ITableAttribute';
import Debouncer from '../util/Debouncer';

import { IconButton } from './TooltipControls';

import * as React from 'react';
import { FormGroup } from 'react-bootstrap';
import FormFeedback from './FormFeedback';

export interface IProps {
  className?: string;
  value: string;
  onChange: (newValue: string, id: string) => void;
  onFocus?: (focused: boolean) => void;
  id?: string;
  label?: string;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
  validate?: (value: any) => ValidationState;
  debounceTimer?: number;
  clearable?: boolean;
}

interface IComponentState {
  cachedValue: string;
}

/**
 * this is a wrapper for the text input-component that is styled like the
 * bootstrap FormControl component.
 * This wrapper uses a "cache" in the state to reduce the number of (costy)
 * rerenders caused by changing the redux store every keypress.
 * As a side effect, this fixes a problem where the cursor always jumps to
 * the end of the line when using controlled input.
 */
class FormInput extends React.PureComponent<IProps, IComponentState> {
  private mDebouncer: Debouncer;
  private mLastCommitted: any;

  constructor(props: IProps) {
    super(props);
    this.state = {
      cachedValue: props.value,
    };
    this.mDebouncer = new Debouncer(newValue => {
      const { onChange, validate } = this.props;
      this.mLastCommitted = newValue;
      if ((validate === undefined)
    || (validate(newValue) !== 'error')) {
        this.props.onChange(newValue, props.id);
      }
      return null;
    }, this.props.debounceTimer || 1000);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if ((newProps.value !== this.props.value)
        && (this.mLastCommitted !== newProps.value)) {
      this.mLastCommitted = newProps.value;
      this.setState({ cachedValue: newProps.value });
    }
  }

  public render(): JSX.Element {
    const { className, clearable, id, label, placeholder, readOnly, type, validate } = this.props;
    const { cachedValue } = this.state;
    const content = (
      <div className={className}>
        <input
          className={'form-control'}
          type={type ?? 'text'}
          title={label}
          value={cachedValue}
          id={id}
          onChange={this.onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          onBlur={this.onBlur}
          onFocus={this.onFocus}
        />
        {clearable ? this.renderClear() : null}
      </div>
    );

    if (validate) {
      const validationState = validate(cachedValue);

      return (
        <FormGroup
          validationState={validationState}
        >
          {content}
          {readOnly ? null : <FormFeedback />}
        </FormGroup>
      );
    } else {
      return content;
    }
  }

  private renderClear() {
    return (
      <IconButton
        className='form-input-clear btn-embed'
        icon='input-cancel'
        tooltip={undefined}
        onClick={this.clear}
      />
    );
  }

  private clear = () => {
    this.setState({ cachedValue: '' });
    this.mDebouncer.schedule(undefined, '');
  }

  private onBlur = (evt: React.FocusEvent<HTMLInputElement>) => {
    const { onFocus } = this.props;
    evt.preventDefault();
    if (onFocus) {
      onFocus(false);
    }
  }

  private onFocus = (evt: React.FocusEvent<HTMLInputElement>) => {
    const { onFocus } = this.props;
    evt.preventDefault();
    if (onFocus) {
      onFocus(true);
    }
  }

  private onChange = (evt: React.FormEvent<HTMLInputElement>) => {
    evt.preventDefault();
    const newValue = evt.currentTarget.value;
    this.setState({ cachedValue: newValue });
    this.mDebouncer.schedule(undefined, newValue);
  }
}

export default FormInput as React.ComponentClass<IProps>;
