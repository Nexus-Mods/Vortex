import Dashlet from '../../../controls/Dashlet';
import Placeholder from '../../../controls/EmptyPlaceholder';
import { IProfile, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { activeGameId } from '../../profile_management/selectors';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameThumbnail from './GameThumbnail';

import Promise from 'bluebird';
import * as React from 'react';

export interface IBaseProps {
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  lastActiveProfile: { [gameId: string]: string };
  profiles: { [id: string]: IProfile };
}

interface IActionProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class RecentlyManaged extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, discoveredGames, gameMode, lastActiveProfile, knownGames, profiles } = this.props;

    const lastManaged = (id: string) => getSafe(profiles,
      [getSafe(lastActiveProfile, [id], undefined), 'lastActivated'], 0);

    const games: IGameStored[] = knownGames
      .filter(game => (game.id !== gameMode)
        && (lastManaged(game.id) !== 0)
        && (getSafe(discoveredGames, [game.id, 'path'], undefined) !== undefined))
      .sort((lhs, rhs) => lastManaged(rhs.id) - lastManaged(lhs.id))
      .slice(0, 3);

    let content: JSX.Element;
    if (games.length === 0) {
      // nothing recently managed
      content = (
        <Placeholder
          icon='game'
          text={t('You don\'t have any recently managed games')}
          fill
        />
      );
    } else {
      content = (
        <div className='list-recently-managed' >
          {games.map(game => (
            <div className='recently-managed-analytics-click' onClick={this.analyticsTrack}>
              <GameThumbnail
                t={t}
                key={game.id}
                game={game}
                type='managed'
                active={false}
                onRefreshGameInfo={this.refreshGameInfo}
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <Dashlet title={t('Recently Managed')} className='dashlet-recently-managed' >
        {content}
      </Dashlet>
    );
  }

  private analyticsTrack = () => {
    this.context.api.events.emit('analytics-track-click-event', 'Dashboard', 'Recent game');
  }

  private refreshGameInfo = gameId => {
    return new Promise<void>((resolve, reject) => {
      this.context.api.events.emit('refresh-game-info', gameId, err => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    lastActiveProfile: state.settings.profiles.lastActiveProfile,
    profiles: state.persistent.profiles,
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(RecentlyManaged)) as React.ComponentClass<{}>;
