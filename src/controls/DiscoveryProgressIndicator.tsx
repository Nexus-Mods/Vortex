import * as React from 'react';
import { connect, PureComponentEx } from '../util/ComponentEx';
import { IState } from '../types/IState';
import Icon from './Icon';
import ProgressBar from './ProgressBar';
import { withTranslation, WithTranslation } from 'react-i18next';

interface IConnectedProps {
  discoveryProgress: any;
  isDiscovering: boolean;
}

type IProps = IConnectedProps & WithTranslation;

class DiscoveryProgressIndicator extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, discoveryProgress, isDiscovering } = this.props;

    if (!isDiscovering || !discoveryProgress) {
      return null;
    }

    const { current, total, message } = discoveryProgress;
    const progressPercent = total > 0 ? (current / total) * 100 : 0;

    return (
      <div className='download-progress-bar'>
        <div className='download-progress-content'>
          <div className='download-progress-header'>
            <Icon name='spinner' spin />
            <span className='download-progress-title'>{t('Game Discovery')}</span>
          </div>
          <div className='download-progress-message'>{message}</div>
          <ProgressBar min={0} max={100} now={progressPercent} />
          <div className='download-progress-stats'>
            {t('{{current}} of {{total}}', { current, total })}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    discoveryProgress: state.session.discoveryProgress?.progress,
    isDiscovering: state.session.discoveryProgress?.isDiscovering || false,
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps)(DiscoveryProgressIndicator)
) as React.ComponentClass<{}>;