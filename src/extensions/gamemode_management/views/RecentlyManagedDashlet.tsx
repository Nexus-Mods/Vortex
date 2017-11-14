import Dashlet from '../../../controls/Dashlet';
import { IDiscoveryState, IProfile, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameThumbnail from './GameThumbnail';

import * as Promise from 'bluebird';
import * as React from 'react';
import { activeGameId } from '../../profile_management/selectors';

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
  private mRef: Element;
  public render(): JSX.Element {
    const { t, discoveredGames, gameMode, lastActiveProfile, knownGames, profiles } = this.props;

    const lastManaged = (id: string) => getSafe(profiles,
      [getSafe(lastActiveProfile, [id], undefined), 'lastActivated'], 0);

    const games: IGameStored[] = knownGames
      .filter(game =>
        (game.id !== gameMode)
        && getSafe(discoveredGames, [game.id, 'path'], undefined) !== undefined)
      .sort((lhs, rhs) => lastManaged(rhs.id) - lastManaged(lhs.id))
      .slice(0, 3);

    return (
      <Dashlet title={t('Recently Managed')} className='dashlet-recently-managed' >
        <div className='list-recently-managed' >
          {games.map(game => (
            <GameThumbnail
              t={t}
              key={game.id}
              game={game}
              type='managed'
              active={false}
              onRefreshGameInfo={this.refreshGameInfo}
            />))}
        </div>
      </Dashlet>
    );
  }

  private openGames = () => {
    this.context.api.events.emit('show-main-page', 'Games');
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

function mapDispatchToProps(dispatch): IActionProps {
  return {
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(RecentlyManaged)) as React.ComponentClass<{}>;
