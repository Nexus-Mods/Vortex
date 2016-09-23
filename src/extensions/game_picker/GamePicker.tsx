import { setGameMode } from '../../actions/settings';
import { IGame } from '../../types/IGame';
import { IDiscoveryResult, IState } from '../../types/IState';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';

import GameThumbnail from './GameThumbnail';

import * as React from 'react';

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  knownGames: IGame[];
  gameMode: string;
}

interface IActionProps {
  onManage: (gameId: string) => void;
}

class GamePicker extends ComponentEx<IConnectedProps & IActionProps, {}> {
  public render(): JSX.Element {
    let { t } = this.props;
    return (
      <div>
        <span style={{ display: 'table' }}>
          <h3>{ t('Discovered') }</h3>
          { this.renderGames(true) }
        </span>
        <span style={{ display: 'table' }}>
          <h3>{ t('Not discovered') }</h3>
          { this.renderGames(false) }
        </span>
      </div>
    );
  }

  private renderGames = (discovered: boolean) => {
    let { onManage, knownGames, discoveredGames, gameMode } = this.props;

    const games = knownGames.filter((game: IGame) => {
        return (game.id in discoveredGames) === discovered;
      });

    return games.map((game) => {
      return (
        <GameThumbnail
          key={game.id}
          game={game}
          onManage={onManage}
          active={game.id === gameMode}
        />
      );
    });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: state.settings.base.gameMode,
    discoveredGames: state.settings.base.discoveredGames,
    knownGames: state.session.knownGames,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onManage: (gameId: string) => dispatch(setGameMode(gameId)),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)
  ) as React.ComponentClass<{}>;
