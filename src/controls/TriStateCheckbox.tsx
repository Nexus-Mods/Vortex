import * as React from 'react';
import { ComponentEx, translate } from '../util/ComponentEx';

export type CheckboxState = 'enabled' | 'disabled' | 'locked';

export interface ITriCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  classNames?: string[];
  disabled: boolean;
  onChangeCB?: (evt: React.ChangeEvent<HTMLInputElement>, value: CheckboxState) => void;
  onContextMenu?: (checkboxState: CheckboxState) => void;
}

interface ITriCheckboxState {
  checkboxState: CheckboxState;
}

class TriStateCheckbox extends ComponentEx<ITriCheckboxProps, ITriCheckboxState> {
  private mRef = null;
  constructor(props: ITriCheckboxProps) {
    super(props);

    this.initState({
      checkboxState: !!props?.indeterminate
        ? 'locked'
        : !!props?.checked ? 'enabled' : 'disabled',
    });
  }

  public render(): JSX.Element {
    const { classNames, indeterminate } = this.props;

    const indeterminateClass = !!indeterminate ? ['indeterminate'] : [''];

    const classes = (!!classNames)
      ? ['tri-state-checkbox'].concat(classNames, indeterminateClass)
      : ['tri-state-checkbox'].concat(indeterminateClass);

    return (
      <div className='tri-state-checkbox-container'>
        <input
          type='checkbox'
          checked={this.state.checkboxState !== 'disabled'}
          className={classes.join(' ')}
          ref={this.onRef}
          onChange={this.onChange}
          onClick={this.onClick}
          onContextMenu={this.onContextMenu}
        />
        {this.props.children}
      </div>
    );
  }

  private onClick = (evt: React.MouseEvent<HTMLInputElement>) => {
    const { disabled } = this.props;
    if (disabled) {
      this.mRef.checked = false;
      this.mRef.indeterminate = false;
      this.mRef.disabled = true;
      return;
    }

    this.mRef.indeterminate = false;
    this.nextState.checkboxState = this.mRef.checked ? 'enabled' : 'disabled';
  }

  private onContextMenu = (evt: React.MouseEvent<HTMLInputElement>) => {
    const { disabled, onContextMenu } = this.props;
    if (disabled || this.mRef === null) {
      return;
    }

    this.mRef.indeterminate = !this.mRef.indeterminate;
    if (!!this.mRef.indeterminate) {
      this.mRef.checked = true;
      this.nextState.checkboxState = 'locked';
    } else {
      this.mRef.checked = true;
      this.nextState.checkboxState = 'enabled';
    }

    if (onContextMenu) {
      onContextMenu(this.nextState.checkboxState);
    }
  }

  private onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { onChangeCB } = this.props;
    const { checkboxState } = this.state;
    if (!!onChangeCB) {
      onChangeCB(evt, checkboxState);
    }
  }

  private onRef = (ref) => {
    if (ref === null) {
      // The checkbox may have moved somewhere
      //  else in the DOM or perhaps it was removed
      //  completely.
      return;
    }

    const { checkboxState } = this.state;
    if (checkboxState === 'locked') {
      ref.indeterminate = true;
    }
    this.mRef = ref;
  }
}

export default translate(['common'])(TriStateCheckbox);
