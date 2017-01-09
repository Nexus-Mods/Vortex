import Icon from './Icon';
import { Button } from './TooltipControls';

import * as React from 'react';

export interface IToolbarIconProps {
  id: string;
  instanceId?: string[];
  tooltip: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  icon: string;
  onClick: (ids: string[]) => void;
}

class ToolbarIcon extends React.Component<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const { id, tooltip, icon } = this.props;
    const placement = this.props.placement || 'bottom';
    return (
      <Button tooltip={tooltip} id={id} placement={placement} onClick={this.invokeAction}>
        <Icon name={icon} />
      </Button>
    );
  }

  private invokeAction = () => {
    const { instanceId, onClick } = this.props;
    onClick(instanceId);
  }
}

export default ToolbarIcon;
