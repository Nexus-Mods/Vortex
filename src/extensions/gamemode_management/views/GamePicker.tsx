import { IComponentContext } from '../../../types/IComponentContext';
import { IGame } from '../../../types/IGame';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { setGameMode } from '../actions/settings';
import { IDiscoveryResult, IDiscoveryState, IGameStored, IStateEx } from '../types/IStateEx';

import GameThumbnail from './GameThumbnail';

import * as React from 'react';
import { Button, ProgressBar } from 'react-bootstrap';
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
}

/**
 * picker/configuration for game modes 
 * 
 * @class GamePicker
 */
class GamePicker extends ComponentEx<IConnectedProps & IActionProps, {}> {

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);

    this.state = {
      discovery: {
        percent: 0,
        label: '',
      },
    };
  }

  public render(): JSX.Element {
    let { t } = this.props;
    const { discovery } = this.props;
    return (
      <Layout type='column'>
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
                active
                min={ 0 }
                max={ 100 }
                now={ discovery.progress }
                label={ `${discovery.directory}` }
              />
            </Flex>
            <Fixed>
              <Button onClick={ this.startDiscovery } disabled={ discovery.running } >
                <Icon name='search' />
              </Button>
            </Fixed>
          </Layout>
        </Fixed>
      </Layout>
    );
  }

  private startDiscovery = () => {
    this.context.api.events.emit('start-discovery', (percent: number, label: string) => {
      log('info', 'progress', { percent, label });
      this.setState(update(this.state, {
        discovery: {
          percent: { $set: percent },
          label: { $set: label },
        },
      }));
    });
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
          onManage={discovered ? onManage : undefined}
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
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)
  ) as React.ComponentClass<{}>;
