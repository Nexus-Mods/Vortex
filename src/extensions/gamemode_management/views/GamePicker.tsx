import { IComponentContext } from '../../../types/IComponentContext';
import { IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { IProfile } from '../../profile_management/types/IProfile';

import { setGameHidden } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameThumbnail from './GameThumbnail';

import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import update = require('react-addons-update');

interface IConnectedProps {
  lastActiveProfile: { [gameId: string]: string };
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  discovery: IDiscoveryState;
}

interface IActionProps {
  onHide: (gameId: string, hidden: boolean) => void;
}

interface IComponentState {
  showHidden: boolean;
}

/**
 * picker/configuration for game modes 
 * 
 * @class GamePicker
 */
class GamePicker extends ComponentEx<IConnectedProps & IActionProps, IComponentState> {

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);

    this.state = {
      showHidden: false,
    };
  }

  public render(): JSX.Element {
    const { t, discoveredGames, discovery, knownGames, profiles } = this.props;
    const { showHidden } = this.state;

    // TODO lots of computation and it doesn't actually change except through discovery
    //   or when adding a profile
    const displayedGames: IGameStored[] = showHidden ? knownGames : knownGames.filter(
      (game: IGameStored) => !getAttr(discoveredGames, game.id, { hidden: false }).hidden);

    const profileGames = new Set<string>(
      Object.keys(profiles).map((profileId: string) => profiles[profileId].gameId));

    let managedGameList: IGameStored[] = [];
    let discoveredGameList: IGameStored[] = [];
    let supportedGameList: IGameStored[] = [];

    displayedGames.forEach((game: IGameStored) => {
      if (getSafe(discoveredGames, [game.id, 'path'], undefined) !== undefined) {
        if (profileGames.has(game.id)) {
          managedGameList.push(game);
        } else {
          discoveredGameList.push(game);
        }
      } else {
        supportedGameList.push(game);
      }
    });

    return (
      <Layout type='column'>
        <Fixed>
          <div>
          <Button
            id='show-hidden-games'
            tooltip={ t('Show / Hide hidden games') }
            onClick={ this.toggleHidden }
          >
            <Icon name={ showHidden ? 'eye-slash' : 'eye' }/>
          </Button>
          </div>
        </Fixed>
        <Flex style={{ height: '100%', overflowY: 'auto' }}>
          <span style={{ display: 'table' }}>
            <h3>{ t('Managed') }</h3>
            { this.renderGames(managedGameList, 'managed') }
          </span>
          <span style={{ display: 'table' }}>
            <h3>{ t('Discovered') }</h3>
            { this.renderGames(discoveredGameList, 'discovered') }
          </span>
          <span style={{ display: 'table' }}>
            <h3>{ t('Supported') }</h3>
            { this.renderGames(supportedGameList, 'undiscovered') }
          </span>
        </Flex>
        <Fixed style={{ height: '40px' }} >
          <Layout type='row'>
            <Flex>
              <ProgressBar
                active={ discovery.running }
                min={ 0 }
                max={ 100 }
                now={ discovery.progress }
                label={ discovery.directory }
              />
            </Flex>
            <Fixed>
              <Button
                id='start-discovery'
                tooltip={ discovery.running ? t('Stop search') : t('Search for games') }
                onClick={ discovery.running ? this.stopDiscovery : this.startDiscovery }
                placement='top'
              >
                <Icon name={ discovery.running ? 'stop' : 'search' } />
              </Button>
            </Fixed>
          </Layout>
        </Fixed>
      </Layout>
    );
  }

  private toggleHidden = () => {
    this.setState(update(this.state, { showHidden: { $set: !this.state.showHidden } }));
  }

  private startDiscovery = () => {
    this.context.api.events.emit('start-discovery');
  }

  private stopDiscovery = () => {
    this.context.api.events.emit('cancel-discovery');
  }

  private renderGames = (games: IGameStored[], type: string) => {
    const { gameMode } = this.props;

    return games.map((game: IGameStored) => {
      return (
        <GameThumbnail
          key={game.id}
          game={game}
          type={type}
          active={game.id === gameMode}
        />
      );
    });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    lastActiveProfile: state.settings.gameMode.lastActiveProfile,
    discoveredGames: state.settings.gameMode.discovered,
    profiles: state.persistent.profiles,
    knownGames: state.session.gameMode.known,
    discovery: state.session.discovery,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onHide: (gameId: string, hidden: boolean) => dispatch(setGameHidden(gameId, hidden)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)
  ) as React.ComponentClass<{}>;
