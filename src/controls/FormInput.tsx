import { ValidationState } from '../types/ITableAttribute';
import Debouncer from '../util/Debouncer';
import { isFunction } from '../util/util';

import { IconButton } from './TooltipControls';

import * as React from 'react';
import { FormGroup } from 'react-bootstrap';
import FormFeedback from './FormFeedback';

export interface IProps {
  className?: string;
  groupClass?: string;
  style?: any;
  value: string | number;
  min?: number;
  max?: number;
  onChange: (newValue: string, id: string) => void;
  onFocus?: (focused: boolean) => void;
  id?: string;
  label?: string;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
  validate?: ValidationState | ((value: any) => ValidationState);
  debounceTimer?: number;
  clearable?: boolean;
  emptyIcon?: string;
  maxLength?: number;
}

interface IComponentState {
  cachedValue: string | number;
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
      const { onChange, value } = this.props;
      this.mLastCommitted = newValue;
      onChange(newValue, props.id);
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
    const { className, clearable, emptyIcon, groupClass, id, label, min, max, maxLength,
      placeholder, readOnly, style, type, validate } = this.props;
    const { cachedValue } = this.state;
    const classes = ['form-input-container'];
    if (className !== undefined) {
      classes.push(className);
    }

    let icon: JSX.Element = null;

    if (cachedValue) {
      if (clearable) {
        this.renderClear();
      }
    } else if (emptyIcon !== undefined) {
      icon = this.renderIcon(emptyIcon);
    }

    if (icon !== null) {
      classes.push('form-input-hasicon');
    }

    const content = (
      <div className={classes.join(' ')} style={style}>
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
          min={min}
          max={max}
          maxLength={maxLength}
        />
        {icon}
      </div>
    );

    if (validate) {
      const validationState = this.validateRes(cachedValue);

      return (
        <FormGroup
          className={groupClass}
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

  private validateRes(value: any): ValidationState {
    const { validate } = this.props;
    if (validate === undefined) {
      return null;
    }
    let validateRes = validate;
    if (isFunction(validate)) {
      validateRes = (validate as any)(value);
    }
    return validateRes as ValidationState;
  }

  private renderIcon(iconName: string) {
    return (
      <IconButton
        className='form-input-clear btn-embed'
        icon={iconName}
        tooltip={undefined}
      />
    );
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
    const { type, min, max } = this.props;
    evt.preventDefault();
    let newValue = evt.currentTarget.value;

    if ((type === 'number') && (newValue.length > 0)) {
      let numValue = parseFloat(newValue);
      if (Number.isNaN(numValue)) {
        // ignore input if it's not valid
        evt.currentTarget.value = this.state.cachedValue.toString();
        return;
      }
      if (min !== undefined) {
        numValue = Math.max(numValue, min);
      }
      if (max !== undefined) {
        numValue = Math.min(numValue, max);
      }
      newValue = numValue.toString();
    }

    this.setState({ cachedValue: newValue });
    this.mDebouncer.schedule(undefined, newValue);
  }
}

export default FormInput as React.ComponentClass<IProps>;
