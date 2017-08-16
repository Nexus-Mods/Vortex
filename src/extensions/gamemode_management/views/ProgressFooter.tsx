import Icon from '../../../controls/Icon';
import { IDiscoveryPhase, IDiscoveryState } from '../../../types/IState';
import { sum } from '../../../util/util';

import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';
import { connect } from 'react-redux';

interface IConnectedProps {
  discovery: IDiscoveryState;
}

type IProps = IConnectedProps;

const ProgressFooter = (props: IProps) => {
  const { discovery } = props;

  const phaseIds = Object.keys(discovery.phases);
  const totalProgress =
    sum(phaseIds.map(idx => discovery.phases[idx].progress)) / phaseIds.length;

  return discovery.running ? (
    <div style={{ display: 'inline', marginLeft: 5, marginRight: 5 }}>
      <Icon name='search' />
      <div className='progress-container'>
        <ProgressBar
          active={true}
          min={0}
          max={100}
          now={totalProgress}
          className='progress-embed'
        />
      </div>
    </div>
  ) : null;
};

function mapStateToProps(state: any): IConnectedProps {
  return {
    discovery: state.session.discovery,
  };
}

export default
  connect(mapStateToProps)(ProgressFooter) as React.ComponentClass<{}>;
