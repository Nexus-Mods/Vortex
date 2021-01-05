import Icon from '../controls/Icon';

import * as React from 'react';

export interface IToggleProps {
  dataId?: string;
  checked: boolean;
  onToggle: (newValue: boolean, dataId?: string) => void;
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
        <div className={classes.join(' ')}>
          <div
            className={`toggle toggle-${checked ? 'on' : 'off'}`}
            onClick={disabled === true ? undefined : this.onToggle}
          >
            <div className='toggle-track'>
              <Icon name={checked ? 'toggle-enabled' : 'toggle-disabled'} />
            </div>
            <div className='toggle-handle'>
              <Icon name='riffle' rotate={90} />
            </div>
          </div>
          <div className='toggle-children'>
            {children}
          </div>
        </div>
      </div>
    );
  }

  private onToggle = () => {
    const { onToggle, checked, dataId } = this.props;
    onToggle(!checked, dataId);
  }
}

export default Toggle;
