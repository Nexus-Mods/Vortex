import { connect } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';

import bytesToString from '../util/bytesToString';

import * as React from 'react';

interface IConnectedProps {
  speed: number;
}

type IProps = IConnectedProps;

const SpeedOMeter = (props: IProps) => {
  return (
    <span><Icon name='tachometer' />{' '}{bytesToString(props.speed)}/s</span>
  );
};

function mapStateToProps(state: any): IConnectedProps {
  return {
    speed: state.persistent.downloads.speed || 0,
  };
}

export default
  connect(mapStateToProps)(SpeedOMeter) as React.ComponentClass<{}>;
