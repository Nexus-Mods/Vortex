import { ComponentEx, connect } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';

interface IDiscoveryState {
  running: boolean;
  progress: number;
  directory: string;
}

interface IConnectedProps {
  discovery: IDiscoveryState;
}

type IProps = IConnectedProps;

class ProgressFooter extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { discovery } = this.props;

    return discovery.running ? (
      <div style={{ display: 'inline', marginLeft: 5, marginRight: 5 }}>
      <Icon name='search' />
      <div className='progress-container'>
      <ProgressBar
        active={true}
        min={0}
        max={100}
        now={discovery.progress}
        className='progress-embed'
      />
      </div>
      </div>
    ) : null;
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    discovery: state.session.discovery,
  };
}

export default
  connect(mapStateToProps)(ProgressFooter) as React.ComponentClass<{}>;
