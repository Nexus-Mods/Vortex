import { connect } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';

import * as React from 'react';

interface IConnectedProps {
  speed: number;
}

type IProps = IConnectedProps;

const labels = [ 'B', 'K', 'M', 'G', 'T' ];

const SpeedOMeter = (props: IProps) => {
  let { speed } = this.props;
  let labelIdx = 0;
  while (speed > 1024) {
    ++labelIdx;
    speed /= 1024;
  }
  return (
    <span><Icon name='tachometer' />{' '}{speed.toFixed(1)} {labels[labelIdx]}/s</span>
  );
};

function mapStateToProps(state: any): IConnectedProps {
  return {
    speed: state.persistent.downloads.speed || 0,
  };
}

export default
  connect(mapStateToProps)(SpeedOMeter) as React.ComponentClass<{}>;
