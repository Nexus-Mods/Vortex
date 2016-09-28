import { SortDirection } from '../types/SortDirection';

import { log } from '../util/log';

import * as React from 'react';
import Icon = require('react-fontawesome');

interface IProps {
  direction: SortDirection;
  onSetDirection: (direction: SortDirection) => void;
}

function next(direction: SortDirection): SortDirection {
  switch (direction) {
    case 'none': return 'asc';
    case 'asc': return 'desc';
    default: return 'none';
  }
}

class SortIndicator extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { direction } = this.props;
    return (
      <div style={{ float: 'right' }} onClick={ this.cycleDirection }>
        <Icon name={ this.icon(direction) } />
      </div>
    );
  }

  private cycleDirection = () => {
    const { direction, onSetDirection } = this.props;

    onSetDirection(next(direction));
  }


  private icon(direction: SortDirection): string {
    switch (direction) {
      case 'none': return 'sort';
      case 'asc': return 'sort-asc';
      case 'desc': return 'sort-desc';
      default: return 'question';
    }
  }
}

export default SortIndicator;
