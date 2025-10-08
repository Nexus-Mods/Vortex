import Icon from '../../../controls/Icon';
import ProgressBar from '../../../controls/ProgressBar';
import RadialProgress from '../../../controls/RadialProgress';
import { IDiscoveryPhase, IDiscoveryState } from '../../../types/IState';
import { connect, PureComponentEx, translate } from '../../../util/ComponentEx';
import { sum } from '../../../util/util';

import * as React from 'react';

export interface IBaseProps {
  slim: boolean;
}

interface IConnectedProps {
  discovery: IDiscoveryState;
  discoveredGames: Array<{ id: string; name?: string }>;
}

type IProps = IBaseProps & IConnectedProps;

class ProgressFooter extends PureComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, discovery, slim, discoveredGames } = this.props;

    const phaseIds = Object.keys(discovery.phases);

    if (!discovery.running) {
      return null;
    }

    const totalProgress = (phaseIds.length > 0)
      ? (sum(phaseIds.map(idx => discovery.phases[idx].progress)) / phaseIds.length)
      : 0;

    if (slim) {
      return (
        <div>
          <div className='discovery-footer-label'>{t('Scan')}</div>
          <RadialProgress
            totalRadius={32}
            data={[{ min: 0, max: 100, value: totalProgress, class: 'running' }]}
          />
          <div className='discovery-footer-sub'>
            {t('Discovered')}: {discoveredGames.length}
          </div>
        </div>
      );
    } else {
      return (
        <div className='discovery-footer'>
          <div className='discovery-footer-label'>{t('Game discovery')}</div>
          <ProgressBar min={0} max={100} now={totalProgress} />
          {discoveredGames.length > 0 && (
            <div className='discovery-footer-list'>
              {t('Discovered')}: {
                (() => {
                  const names = discoveredGames.map(g => g.name || g.id);
                  const maxShow = 5;
                  const shown = names.slice(0, maxShow).join(', ');
                  const remaining = names.length - maxShow;
                  return remaining > 0 ? `${shown} +${remaining} more` : shown;
                })()
              }
            </div>
          )}
        </div>
      );
    }
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    discovery: state.session.discovery,
    discoveredGames: Object.keys(state.settings.gameMode.discovered || {})
      .filter(id => (state.settings.gameMode.discovered[id]?.path !== undefined))
      .map(id => ({ id, name: state.settings.gameMode.discovered[id]?.name })),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(
      ProgressFooter)) as React.ComponentClass<IBaseProps>;
