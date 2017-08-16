import Icon from '../controls/Icon';

import * as React from 'react';

export interface IToggleProps {
  checked: boolean;
  onToggle: (newValue: boolean) => void;
}

export type IProps = React.HTMLAttributes<HTMLDivElement> & IToggleProps;

class Toggle extends React.PureComponent<IProps, {}> {
  public render(): JSX.Element {
    const { children, checked } = this.props;

    return (
      <div>
        <div className='toggle-container' onClick={this.onToggle}>
          <div className={`toggle toggle-${checked ? 'on' : 'off'}`}>
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
