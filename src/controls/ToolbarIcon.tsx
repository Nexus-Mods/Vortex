import Icon from './Icon';
import { ButtonType } from './IconBar';
import { Button } from './TooltipControls';

import * as React from 'react';

export interface IToolbarIconProps {
  id?: string;
  instanceId?: string[];
  text?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  iconSet?: string;
  icon?: string;
  onClick?: (ids: string[]) => void;
  pulse?: boolean;
  disabled?: boolean;
  className?: string;
}

class ToolbarIcon extends React.PureComponent<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const { className, id, text, icon, iconSet, pulse, disabled} = this.props;
    const placement = this.props.placement || 'bottom';
    return (
      <Button
        tooltip={text}
        id={id}
        placement={placement}
        onClick={this.invokeAction}
        disabled={disabled}
        className={className}
      >
        {icon !== undefined ? <Icon set={iconSet} name={icon} pulse={pulse} /> : null}
        {text !== undefined ? <div className='button-text'>{text}</div> : null}
        {this.props.children}
      </Button>
    );
  }

  private invokeAction = () => {
    const { instanceId, onClick } = this.props;
    if (onClick !== undefined) {
      onClick(instanceId);
    }
  }
}

export default ToolbarIcon;
