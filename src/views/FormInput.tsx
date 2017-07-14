import Debouncer from '../util/Debouncer';

import * as React from 'react';
import {FormControlProps} from 'react-bootstrap';

export interface IProps {
  value: string;
  onChange: (newValue: string) => void;
  id?: string;
  label?: string;
  readOnly?: boolean;
  placeholder?: string;
}

export interface IComponentState {
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

  constructor(props: IProps) {
    super(props);
    this.state = {
      cachedValue: props.value,
    };
    this.mDebouncer = new Debouncer(newValue => {
      this.props.onChange(newValue);
      return null;
    }, 250);
  }

  public render(): JSX.Element {
    const { id, label, placeholder, readOnly } = this.props;
    const { cachedValue } = this.state;
    return (
      <input
        className='form-control'
        type='text'
        title={label}
        value={cachedValue}
        id={id}
        onChange={this.onChange}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    );
  }

  private onChange = (evt: React.FormEvent<HTMLInputElement>) => {
    evt.preventDefault();
    const newValue = evt.currentTarget.value;
    this.setState({ cachedValue: newValue });
    this.mDebouncer.schedule(undefined, newValue);
  }
}

export default FormInput;
