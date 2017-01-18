import * as React from 'react';
import {FormControlProps} from 'react-bootstrap';

export interface IProps extends FormControlProps {
  value: string;
}

export interface IComponentState {
  cursorPos: number;
}

/**
 * this is a wrapper for the text input-component that is styled like the
 * bootstrap FormControl component.
 * This wrapper fixes a problem where the cursor always jums to the end of
 * the line if the component is controlled and the value is not managed
 * by react itself (through setState).
 */
class FormInput extends React.PureComponent<IProps, IComponentState> {
  private mInput: HTMLInputElement;

  constructor(props: IProps) {
    super(props);
    this.state = {
      cursorPos: props.value.length,
    };
  }

  public componentDidUpdate() {
    this.mInput.setSelectionRange(this.state.cursorPos, this.state.cursorPos);
  }

  public render(): JSX.Element {
    const { id, label, value } = this.props;
    return <input
      className='form-control'
      type='text'
      label={label}
      value={value}
      id={id}
      ref={this.setDOMControl}
      onChange={this.onChange}
    />;
  }

  private setDOMControl = (ctrl: HTMLInputElement) => {
    this.mInput = ctrl;
  }

  private onChange = (evt: React.FormEvent<HTMLInputElement>) => {
    evt.preventDefault();
    this.setState({ cursorPos: evt.currentTarget.selectionEnd });
    this.props.onChange(evt as any);
  }
}

export default FormInput;
