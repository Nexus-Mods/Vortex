import { IconButton } from './TooltipControls';

import * as React from 'react';

export interface ICollapseIconProps {
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  onClick: () => void;
  visible: boolean;
}

class CollapseIcon extends React.PureComponent<ICollapseIconProps, {}> {
  public render(): JSX.Element {
    const { onClick, position, visible } = this.props;

    // direction of the hide icon
    let iconUp = position === 'bottomleft' || position === 'bottomright';
    if (!visible) {
      iconUp = !iconUp;
    }

    const classes = ['collapseicon'];
    classes.push(`collapseicon-${visible ? 'show' : 'hide'}`);
    classes.push(`collapseicon-${position}`);

    return (
      <IconButton
        className={classes.join(' ')}
        bsStyle={'ghost'}
        tooltip=''
        icon={`showhide-${iconUp ? 'up' : 'down'}`}
        onClick={onClick}
      />
    );
  }
}

export default CollapseIcon;
