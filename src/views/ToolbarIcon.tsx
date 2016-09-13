import { Button } from './TooltipControls';

import * as React from 'react';
import Icon = require('react-fontawesome');

interface IToolbarIconProps {
  id: string;
  tooltip: string;
  icon: string;
  onClick: () => void;
}

class ToolbarIcon extends React.Component<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    let { id, tooltip, icon, onClick } = this.props;
    return (
          <Button tooltip={tooltip} id={id} placement='bottom' onClick={ onClick }>
            <Icon name={icon} />
          </Button>
    );
  }
}

export default ToolbarIcon;
