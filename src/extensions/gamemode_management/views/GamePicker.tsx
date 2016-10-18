import { IComponentContext } from '../../../types/IComponentContext';
import { IGame } from '../../../types/IGame';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import { Button } from '../../../views/TooltipControls';

import { setGameHidden, setGameMode } from '../actions/settings';
import { IDiscoveryResult, IDiscoveryState, IGameStored, IStateEx } from '../types/IStateEx';

import GameThumbnail from './GameThumbnail';

import * as React from 'react';
import { ProgressBar } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import { log } from '../../../util/log';

import Icon = require('react-fontawesome');
import update = require('react-addons-update');

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  knownGames: IGameStored[];
  gameMode: string;
  discovery: IDiscoveryState;
}

interface IActionProps {
  onManage: (gameId: string) => void;
  onHide: (gameId: string, hidden: boolean) => void;
}

interface IState {
  showHidden: boolean;
}

/**
 * picker/configuration for game modes 
 * 
 * @class GamePicker
 */
class GamePicker extends ComponentEx<IConnectedProps & IActionProps, IState> {

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
    const { t, discovery } = this.props;
    const { showHidden } = this.state;
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
            <h3>{ t('Discovered') }</h3>
            { this.renderGames(true) }
          </span>
          <span style={{ display: 'table' }}>
            <h3>{ t('Not discovered') }</h3>
            { this.renderGames(false) }
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

  private renderGames = (discovered: boolean) => {
    const { onManage, onHide, knownGames, discoveredGames, gameMode } = this.props;
    const { showHidden } = this.state;

    const games: IGameStored[] = knownGames.filter((game: IGame) => {
        return (((getAttr(discoveredGames, game.id, { path: '' }).path !== '') === discovered)
          && (showHidden || !getAttr(discoveredGames, game.id, { hidden: false }).hidden));
      });

    return games.map((game: IGameStored) => {
      return (
        <GameThumbnail
          key={game.id}
          game={game}
          onManage={discovered ? onManage : undefined}
          hidden={getAttr(discoveredGames, game.id, { hidden: false }).hidden}
          onHide={onHide}
          active={game.id === gameMode}
        />
      );
    });
  }
}

function mapStateToProps(state: IStateEx): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    discoveredGames: state.settings.gameMode.discovered,
    knownGames: state.session.gameMode.known,
    discovery: state.session.discovery,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onManage: (gameId: string) => dispatch(setGameMode(gameId)),
    onHide: (gameId: string, hidden: boolean) => dispatch(setGameHidden(gameId, hidden)),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)
  ) as React.ComponentClass<{}>;
