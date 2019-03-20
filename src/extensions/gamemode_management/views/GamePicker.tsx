import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import IconBar from '../../../controls/IconBar';
import { IconButton, ToggleButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDiscoveryPhase, IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';

import { IProfile } from '../../profile_management/types/IProfile';

import { setPickerLayout } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameRow from './GameRow';
import GameThumbnail from './GameThumbnail';
import ShowHiddenButton from './ShowHiddenButton';

import * as Promise from 'bluebird';
import update from 'immutability-helper';
import * as React from 'react';
import { ListGroup, ProgressBar, Tab, Tabs, FormControl, InputGroup } from 'react-bootstrap';

function gameFromDiscovery(id: string, discovered: IDiscoveryResult): IGameStored {
  return {
    id,
    name: discovered.name,
    shortName: discovered.shortName,
    executable: discovered.executable,
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
  onSetPickerLayout: (layout: 'list' | 'small' | 'large') => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  showHidden: boolean;
  currentFilterValue: string;
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

    this.initState({
      showHidden: false,
      currentFilterValue: '',
    });

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
    const { showHidden, currentFilterValue } = this.state;

    // TODO: lots of computation and it doesn't actually change except through discovery
    //   or when adding a profile
    const displayedGames: IGameStored[] = ((showHidden) || (!!currentFilterValue))
      ? knownGames 
      : knownGames.filter((game: IGameStored) => !getAttr(discoveredGames, game.id, { hidden: false }).hidden);

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

    const title = (text: string, count: string) => {
      return (
        <div className='nav-title'>
        <div className='nav-title-title'>{text}</div>
        <div className='nav-title-count'>({count})</div>
      </div>
      );
    };

    const filteredManaged = managedGameList.filter(game => this.applyGameFilter(game));
    const filteredDiscovered = discoveredGameList.filter(game => this.applyGameFilter(game));
    const filteredSupported = supportedGameList.filter(game => this.applyGameFilter(game))

    return (
      <MainPage domRef={this.setRef}>
        <MainPage.Header>
          <IconBar
            group='game-icons'
            staticElements={this.buttons}
            className='menubar'
            t={t}
          />
          <div className='flex-fill' />
          <IconBar
            id='gamepicker-layout-list'
            group='gamepicker-layout-icons'
            staticElements={[]}
            className='menubar'
            t={t}
          >
            <ToggleButton
              id='gamepicker-layout-list'
              onClick={this.setLayoutList}
              onIcon='layout-list'
              offIcon='layout-list'
              tooltip={t('List')}
              offTooltip={t('List')}
              state={pickerLayout === 'list'}
            >
              <span className='button-text'>{t('List View')}</span>
            </ToggleButton>
            <ToggleButton
              id='gamepicker-layout-grid'
              onClick={this.setLayoutSmall}
              onIcon='layout-grid'
              offIcon='layout-grid'
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
            <FlexLayout.Fixed>
              <InputGroup>
                <FormControl
                  className='game-filter-input'
                  value={currentFilterValue}
                  placeholder={t('Search for a game...')}
                  onChange={this.onFilterInputChange}
                />
              </InputGroup>
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <div ref={this.setScrollRef} className='gamepicker-body'>
                <Tabs defaultActiveKey='managed' id='games-picker-tabs'>
                  <Tab
                    eventKey='managed'
                    title={title(t('Managed'), this.getTabGameNumber(managedGameList, filteredManaged))}
                  >
                    {this.renderGames(filteredManaged, 'managed')}
                  </Tab>
                  <Tab
                    eventKey='discovered'
                    title={title(t('Discovered'), this.getTabGameNumber(discoveredGameList, filteredDiscovered))}
                  >
                    {this.renderGames(filteredDiscovered, 'discovered')}
                  </Tab>
                  <Tab
                    eventKey='supported'
                    title={title(t('Supported'), this.getTabGameNumber(supportedGameList, filteredSupported))}
                  >
                    {this.renderGames(filteredSupported, 'undiscovered')}
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
                    icon={discovery.running ? 'stop' : 'search'}
                    tooltip={discovery.running ? t('Stop Scan') : t('Scan for Games')}
                    onClick={discovery.running ? this.stopDiscovery : this.startDiscovery}
                  >
                    {discovery.running ? t('Stop Scan') : t('Scan for Games')}
                  </IconButton>
                </FlexLayout.Fixed>
              </div>
            </FlexLayout.Fixed>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private onFilterInputChange = (evt) => {
    this.nextState.currentFilterValue = evt.target.value;
  }

  private getTabGameNumber(unfiltered: IGameStored[], filtered: IGameStored[]): string {
    const { currentFilterValue } = this.state;
    return currentFilterValue ? `${filtered.length}/${unfiltered.length}` : `${unfiltered.length}`;
  }

  private applyGameFilter = (game: IGameStored): boolean => {
    const { currentFilterValue } = this.state;
    return game.name.toLowerCase().includes(currentFilterValue.toLowerCase()) || !currentFilterValue;
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
        label={<span>{phase.directory}</span>}
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
    const { currentFilterValue } = this.state;

    const failedFilter = (): JSX.Element => (
      <EmptyPlaceholder
        icon='game'
        text={t('Vortex cannot find "{{gameName}}" in selected tab', {replace: { gameName: currentFilterValue } })}
        subtext={t('Please switch tab, try alternative spellings, or submit a game request via the feedback system.')}
      />
    );

    if (games.length === 0) {
      if (type === 'managed') {
        return (!!currentFilterValue)
        ? failedFilter()
        : (
          <EmptyPlaceholder
            icon='game'
            text={t('You haven\'t managed any games yet')}
            subtext={t('To start managing a game, go to "Discovered" and activate a game there.')}
          />
        );
      } else if (type === 'discovered') {
        return (!!currentFilterValue)
        ? failedFilter()
        : (
          <EmptyPlaceholder
            icon='game'
            text={t('No games were discovered')}
            subtext={t('You can manually add a game from "Supported" or start a full disk scan.')}
          />
        );
      } else if ((type === 'undiscovered') && (!!currentFilterValue)) {
        return failedFilter();
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
    onSetPickerLayout: (layout) =>
      dispatch(setPickerLayout(layout)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)) as React.ComponentClass<{}>;
