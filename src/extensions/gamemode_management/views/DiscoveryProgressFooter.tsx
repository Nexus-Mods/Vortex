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

class DiscoveryProgressFooter extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, discoveryProgress, isDiscovering } = this.props;

    if (!isDiscovering || !discoveryProgress) {
      return null;
    }

    const { current, total, message } = discoveryProgress;
    const progressPercent = total > 0 ? (current / total) * 100 : 0;

    // Reuse the download progress bar UI pattern
    return (
      <div className='active-downloads-container'>
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
    discoveryProgress: (state.session as any).discoveryProgress?.progress,
    isDiscovering: (state.session as any).discoveryProgress?.isDiscovering || false,
  };
}

export default translate(['common'])(
  connect(mapStateToProps)(DiscoveryProgressFooter)
) as React.ComponentClass<{}>;