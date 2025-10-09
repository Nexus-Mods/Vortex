import * as React from 'react';
import { connect, translate, PureComponentEx } from '../../../util/ComponentEx';
import { IState } from '../../../types/IState';
import ProgressBar from '../../../controls/ProgressBar';
import Icon from '../../../controls/Icon';
import { TFunction } from '../../../util/i18n';

interface IConnectedProps {
  discoveryProgress: any;
  isDiscovering: boolean;
}

interface IActionProps {
  t: TFunction;
}

type IProps = IConnectedProps & IActionProps;

class DiscoveryProgressOverlay extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, discoveryProgress, isDiscovering } = this.props;

    if (!isDiscovering || !discoveryProgress) {
      return null;
    }

    const { current, total, message } = discoveryProgress;
    const progressPercent = total > 0 ? (current / total) * 100 : 0;

    // Reuse the download progress bar UI pattern but position in bottom left
    return (
      <div className='discovery-progress-overlay active-downloads-container'>
        <span>{t('Game Discovery')}</span>
        <ProgressBar
          min={0}
          max={100}
          now={progressPercent}
          labelLeft={message}
          labelRight={total > 0 ? `${current}/${total}` : ''}
        />
      </div>
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    discoveryProgress: state.session.discoveryProgress,
    isDiscovering: state.session.isDiscovering || false,
  };
}

export default translate(['common'])(
  connect(mapStateToProps)(DiscoveryProgressOverlay)
) as React.ComponentClass<{}>;