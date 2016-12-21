import Icon from './Icon';
import { Button } from './TooltipControls';

import * as React from 'react';

export interface IToolbarIconProps {
  id: string;
  tooltip: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  icon: string;
  onClick: () => void;
}

class ToolbarIcon extends React.Component<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const { id, tooltip, icon, onClick } = this.props;
    const placement = this.props.placement || 'bottom';
    return (
      <Button tooltip={tooltip} id={id} placement={placement} onClick={onClick}>
        <Icon name={icon} />
      </Button>
    );
  }
}

export default ToolbarIcon;
