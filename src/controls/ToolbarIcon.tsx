import Icon from './Icon';
import { Button } from './TooltipControls';

import * as React from 'react';

export interface IToolbarIconProps {
  id?: string;
  instanceId?: string[];
  text?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  iconSet?: string;
  icon?: string;
  tooltip?: string;
  onClick?: (ids: string[]) => void;
  pulse?: boolean;
  spin?: boolean;
  disabled?: boolean;
  className?: string;
  stroke?: boolean;
  hollow?: boolean;
}

class ToolbarIcon extends React.PureComponent<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const { className, id, text, tooltip, icon, iconSet, pulse, spin,
            stroke, hollow, disabled} = this.props;
    const placement = this.props.placement || 'bottom';
    return (
      <Button
        tooltip={tooltip}
        id={id}
        placement={placement}
        onClick={this.invokeAction}
        disabled={disabled}
        className={className}
      >
        {icon !== undefined ? (
          <Icon
            set={iconSet}
            name={icon}
            pulse={pulse}
            spin={spin}
            stroke={stroke}
            hollow={hollow}
          />
         ) : null}
        {text !== undefined ? <div className='button-text'>{text}</div> : null}
        {this.props.children}
      </Button>
    );
  }

  private invokeAction = (evt: React.MouseEvent<Button>) => {
    const { instanceId, onClick } = this.props;
    if (onClick !== undefined) {
      evt.preventDefault();
      onClick(instanceId);
    }
  }
}

export default ToolbarIcon;
