import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import * as React from 'react';

import Icon = require('react-fontawesome');

interface IConnectedProps {
  speed: number;
}

type IProps = IConnectedProps;

class SpeedOMeter extends ComponentEx<IProps, {}> {
  private labels = [ 'B', 'K', 'M', 'G', 'T' ];
  public render(): JSX.Element {
    let { speed } = this.props;
    let labelIdx = 0;
    while (speed > 1024) {
      ++labelIdx;
      speed /= 1024;
    }
    return (
      <span><Icon name='tachometer' />{' '}{speed.toFixed(1)} {this.labels[labelIdx]}/s</span>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    speed: state.persistent.downloads.speed,
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: true })(SpeedOMeter)
  );
