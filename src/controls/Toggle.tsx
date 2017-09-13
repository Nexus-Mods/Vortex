import Icon from '../controls/Icon';

import * as React from 'react';

export interface IToggleProps {
  checked: boolean;
  onToggle: (newValue: boolean) => void;
  disabled?: boolean;
}

export type IProps = React.HTMLAttributes<HTMLDivElement> & IToggleProps;

class Toggle extends React.PureComponent<IProps, {}> {
  public render(): JSX.Element {
    const { children, checked, disabled } = this.props;

    const classes = ['toggle-container'];
    if (disabled === true) {
      classes.push('toggle-disabled');
    }

    return (
      <div>
        <div className='toggle-container'>
          <div
            className={`toggle toggle-${checked ? 'on' : 'off'}`}
            onClick={disabled === true ? undefined : this.onToggle}
          >
            <div className='toggle-track' />
            <div className='toggle-handle'>
              <Icon name={checked ? 'check' : 'cross'} />
            </div>
          </div>
          <div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  private onToggle = () => {
    const { onToggle, checked } = this.props;
    onToggle(!checked);
  }
}

export default Toggle;
