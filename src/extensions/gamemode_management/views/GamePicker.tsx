import { DialogActions, DialogType,
         IDialogContent, showDialog } from '../../../actions/notifications';
import Advanced from '../../../controls/Advanced';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import IconBar, { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { Button, IconButton, ToggleButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDiscoveryPhase, IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';

import { setGamePath } from '../../gamemode_management/actions/settings';
import { IProfile } from '../../profile_management/types/IProfile';

import { addDiscoveredGame, setGameHidden, setPickerLayout } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameRow from './GameRow';
import GameThumbnail from './GameThumbnail';
import ShowHiddenButton from './ShowHiddenButton';

import * as Promise from 'bluebird';
import * as update from 'immutability-helper';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { ListGroup, ProgressBar, Tab, Tabs } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

function gameFromDiscovery(id: string, discovered: IDiscoveryResult): IGameStored {
  return {
    id,
    name: discovered.name,
    shortName: discovered.shortName,
    executable: discovered.executable,
    mergeMods: discovered.mergeMods,
    extensionPath: discovered.extensionPath,
    logo: discovered.logo,
    requiredFiles: [],
    supportedTools: [],
  };
}

interface IBaseProps {
  onRefreshGameInfo: (gameId: string) => Promise<void>;
  onBrowseGameLocation: (gameId: string) => Promise<void>;
}

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  discovery: IDiscoveryState;
  pickerLayout: 'list' | 'small' | 'large';
}

interface IActionProps {
  onHide: (gameId: string, hidden: boolean) => void;
  onSetPickerLayout: (layout: 'list' | 'small' | 'large') => void;
  onSetGamePath: (gameId: string, gamePath: string) => void;
  onAddDiscoveredGame: (gameId: string, result: IDiscoveryResult) => void;
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: DialogActions) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  showHidden: boolean;
}

/**
 * picker/configuration for game modes
 *
 * @class GamePicker
 */
class GamePicker extends ComponentEx<IProps, IComponentState> {
  public context: IComponentContext;

  private buttons: IActionDefinition[];
  private mRef: HTMLElement;
  private mScrollRef: HTMLElement;

  constructor(props: IProps) {
    super(props);

    this.state = {
      showHidden: false,
    };

    this.buttons = [
      {
        component: ShowHiddenButton,
        props: () =>
          ({ t: this.props.t, showHidden: this.state.showHidden, toggleHidden: this.toggleHidden }),
      },
    ];
  }

  public render(): JSX.Element {
    const { t, discoveredGames, discovery, knownGames, pickerLayout, profiles } = this.props;
    const { showHidden } = this.state;

    // TODO: lots of computation and it doesn't actually change except through discovery
    //   or when adding a profile
    const displayedGames: IGameStored[] = showHidden ? knownGames : knownGames.filter(
      (game: IGameStored) => !getAttr(discoveredGames, game.id, { hidden: false }).hidden);

    const profileGames = new Set<string>(
      Object.keys(profiles).map((profileId: string) => profiles[profileId].gameId));

    const managedGameList: IGameStored[] = [];
    const discoveredGameList: IGameStored[] = [];
    const supportedGameList: IGameStored[] = [];

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

    Object.keys(discoveredGames).forEach(gameId => {
      if (knownGames.find(game => game.id === gameId) === undefined) {
        if (discoveredGames[gameId].extensionPath === undefined) {
          return;
        }
        if (profileGames.has(gameId)) {
          managedGameList.push(gameFromDiscovery(gameId, discoveredGames[gameId]));
        } else {
          discoveredGameList.push(gameFromDiscovery(gameId, discoveredGames[gameId]));
        }
      }
    });

    return (
      <MainPage domRef={this.setRef}>
        <MainPage.Header>
          <IconBar
            group='game-icons'
            staticElements={this.buttons}
            className='menubar'
          />
          <div className='flex-fill' />
          <IconBar
            id='gamepicker-layout-list'
            group='gamepicker-layout-icons'
            staticElements={[]}
            className='menubar'
          >
            <ToggleButton
              id='gamepicker-layout-list'
              onClick={this.setLayoutList}
              onIcon='list'
              offIcon='list'
              tooltip={t('List')}
              offTooltip={t('List')}
              state={pickerLayout === 'list'}
            >
              <span className='button-text'>{t('List View')}</span>
            </ToggleButton>
            <ToggleButton
              id='gamepicker-layout-grid'
              onClick={this.setLayoutSmall}
              onIcon='grid'
              offIcon='grid'
              tooltip={t('Grid')}
              offTooltip={t('Grid')}
              state={pickerLayout === 'small'}
            >
              <span className='button-text'>{t('Grid View')}</span>
            </ToggleButton>
          </IconBar>
        </MainPage.Header>
        <MainPage.Body>
          <FlexLayout type='column' className='game-page'>
            <FlexLayout.Flex>
              <div ref={this.setScrollRef} className='gamepicker-body'>
                <Tabs defaultActiveKey='managed' id='games-picker-tabs'>
                  <Tab
                    eventKey='managed'
                    title={t('Managed ({{ num }})', { replace: { num: managedGameList.length } })}
                  >
                    {this.renderGames(managedGameList, 'managed')}
                  </Tab>
                  <Tab
                    eventKey='discovered'
                    title={t('Discovered ({{ num }})', {
                      replace: { num: discoveredGameList.length } })}
                  >
                    {this.renderGames(discoveredGameList, 'discovered')}
                  </Tab>
                  <Tab
                    eventKey='supported'
                    title={t('Supported ({{ num }})', {
                      replace: { num: supportedGameList.length } })}
                  >
                    {this.renderGames(supportedGameList, 'undiscovered')}
                  </Tab>
                </Tabs>
              </div>
            </FlexLayout.Flex>
            <FlexLayout.Fixed>
              <div className='discovery-progress-container'>
                <FlexLayout.Flex>
                  <ProgressBar>
                  {Object.keys(discovery.phases)
                    .map(idx => discovery.phases[idx]).map(this.renderProgress)}
                  </ProgressBar>
                </FlexLayout.Flex>
                <FlexLayout.Fixed>
                  <IconButton
                    id='start-discovery'
                    icon={discovery.running ? 'button-stop' : 'search'}
                    tooltip={discovery.running ? t('Stop search') : t('Search for games')}
                    onClick={discovery.running ? this.stopDiscovery : this.startDiscovery}
                  >
                    {discovery.running ? t('Stop search') : t('Search for games')}
                  </IconButton>
                </FlexLayout.Fixed>
              </div>
            </FlexLayout.Fixed>
          </FlexLayout>
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='game-icons'
            staticElements={this.buttons}
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private renderProgress = (phase: IDiscoveryPhase, idx: number): JSX.Element => {
    const { discovery } = this.props;
    if (phase === undefined) {
      return <ProgressBar />;
    }
    return (
      <ProgressBar
        striped={phase.progress < 100}
        key={idx}
        className={`discovery-progress-${idx % 4}`}
        active={phase.progress < 100}
        min={0}
        max={100 * Object.keys(discovery.phases).length}
        now={phase.progress}
        label={phase.directory}
      />
    );
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private setScrollRef = ref => {
    this.mScrollRef = ref;
    this.forceUpdate();
  }

  private getBounds = () => this.mRef.getBoundingClientRect();

  private getScrollContainer = () => this.mScrollRef;

  private toggleHidden = () => {
    this.setState(update(this.state, { showHidden: { $set: !this.state.showHidden } }));
  }

  private setLayoutList = () => {
    this.props.onSetPickerLayout('list');
  }

  private setLayoutSmall = () => {
    this.props.onSetPickerLayout('small');
  }

  private startDiscovery = () => {
    this.context.api.events.emit('start-discovery');
  }

  private stopDiscovery = () => {
    this.context.api.events.emit('cancel-discovery');
  }

  private renderGames = (games: IGameStored[], type: string): JSX.Element => {
    const { t, gameMode, pickerLayout } = this.props;

    if (games.length === 0) {
      if (type === 'managed') {
        return (
          <EmptyPlaceholder
            icon='controller'
            text={t('You haven\'t managed any games yet')}
            subtext={t('To start managing a game, go to "Discovered" and activate a game there.')}
          />
        );
      } else if (type === 'discovered') {
        return (
          <EmptyPlaceholder
            icon='controller'
            text={t('No games were discovered')}
            subtext={t('You can manually add a game from "Supported" or start a full disk scan.')}
          />
        );
      }
    }

    switch (pickerLayout) {
      case 'list': return this.renderGamesList(games, type, gameMode);
      case 'small': return this.renderGamesSmall(games, type, gameMode);
      default: throw new Error('invalid picker layout ' + pickerLayout);
    }
  }

  private renderGamesList(games: IGameStored[], type: string, gameMode: string): JSX.Element {
    const { t, discoveredGames, onRefreshGameInfo } = this.props;

    return (
      <ListGroup>
        {games.map(game => (
          <GameRow
            t={t}
            getBounds={this.getBounds}
            container={this.mScrollRef}
            key={game.id}
            game={game}
            discovery={discoveredGames[game.id]}
            type={type}
            active={game.id === gameMode}
            onRefreshGameInfo={onRefreshGameInfo}
            onBrowseGameLocation={this.props.onBrowseGameLocation}
          />))
        }
      </ListGroup>
    );
  }

  private renderGamesSmall(games: IGameStored[], type: string, gameMode: string) {
    const { t, onRefreshGameInfo } = this.props;
    return (
      <div>
      <div className='game-group'>
        {games.map(game => (
          <GameThumbnail
            t={t}
            key={game.id}
            game={game}
            type={type}
            active={game.id === gameMode}
            onRefreshGameInfo={onRefreshGameInfo}
            getBounds={this.getBounds}
            container={this.mScrollRef}
          />))
        }
      </div>
      </div>
    );
  }

  private setGamePath = (gameId: string, gamePath: string) => {
    this.props.onSetGamePath(gameId, gamePath);
  }

  private addDiscoveredGame = (gameId: string, discovery: IDiscoveryResult) => {
    this.props.onAddDiscoveredGame(gameId, discovery);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    discoveredGames: state.settings.gameMode.discovered,
    pickerLayout: state.settings.gameMode.pickerLayout || 'list',
    profiles: state.persistent.profiles,
    knownGames: state.session.gameMode.known,
    discovery: state.session.discovery,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onHide: (gameId: string, hidden: boolean) =>
      dispatch(setGameHidden(gameId, hidden)),
    onSetPickerLayout: (layout) =>
      dispatch(setPickerLayout(layout)),
    onSetGamePath: (gameId: string, gamePath: string) =>
      dispatch(setGamePath(gameId, gamePath)),
    onAddDiscoveredGame: (gameId: string, result: IDiscoveryResult) =>
      dispatch(addDiscoveredGame(gameId, result)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)) as React.ComponentClass<{}>;
