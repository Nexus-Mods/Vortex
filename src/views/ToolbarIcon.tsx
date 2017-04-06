import Icon from './Icon';
import { Button } from './TooltipControls';

import * as React from 'react';

export interface IToolbarIconProps {
  id: string;
  instanceId?: string[];
  text: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  buttonType?: 'icon' | 'text' | 'both';
  icon: string;
  onClick: (ids: string[]) => void;
}

class ToolbarIcon extends React.Component<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const { buttonType, id, text, icon } = this.props;
    const placement = this.props.placement || 'bottom';
    let bType = buttonType || 'icon';
    return (
      <Button tooltip={text} id={id} placement={placement} onClick={this.invokeAction}>
        { ['icon', 'both'].indexOf(bType) !== -1 ? <Icon name={icon} /> : null }
        { ['text', 'both'].indexOf(bType) !== -1 ? <p>{text}</p> : null }
      </Button>
    );
  }

  private invokeAction = () => {
    const { instanceId, onClick } = this.props;
    onClick(instanceId);
  }
}

export default ToolbarIcon;
