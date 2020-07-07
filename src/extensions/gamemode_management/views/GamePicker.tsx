import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import FormInput from '../../../controls/FormInput';
import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import { IconButton, ToggleButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDiscoveryPhase, IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import opn from '../../../util/opn';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { IAvailableExtension, IExtension } from '../../extension_manager/types';
import { IProfile } from '../../profile_management/types/IProfile';

import { setPickerLayout } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameRow from './GameRow';
import GameThumbnail from './GameThumbnail';
import ShowHiddenButton from './ShowHiddenButton';

import Promise from 'bluebird';
import update from 'immutability-helper';
import * as React from 'react';
import { FormControl, InputGroup, ListGroup,
         Panel, PanelGroup, ProgressBar } from 'react-bootstrap';

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

function byGameName(lhs: IGameStored, rhs: IGameStored): number {
  return lhs.name.localeCompare(rhs.name);
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
  extensions: IAvailableExtension[];
  extensionsInstalled: { [extId: string]: IExtension };
}

interface IActionProps {
  onSetPickerLayout: (layout: 'list' | 'small' | 'large') => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  showHidden: boolean;
  currentFilterValue: string;
  expandManaged: boolean;
  expandUnmanaged: boolean;
}

function nop() {
  // nop
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
      expandManaged: true,
      expandUnmanaged: true,
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
    const { t, discoveredGames, discovery, extensions, extensionsInstalled, knownGames,
            pickerLayout, profiles } = this.props;
    const { showHidden, currentFilterValue, expandManaged, expandUnmanaged } = this.state;

    const installedExtIds = new Set(Object.values(extensionsInstalled).map(ext => ext.modId));
    const installedNames = new Set(Object.values(extensionsInstalled).map(ext => ext.name));

    const gameExts = extensions
      .filter(ext => ext.type === 'game')
      .filter(ext => !installedExtIds.has(ext.modId) && !installedNames.has(ext.name));

    // TODO: lots of computation and it doesn't actually change except through discovery
    //   or when adding a profile
    const displayedGames: IGameStored[] = ((showHidden) || (!!currentFilterValue))
      ? knownGames
      : knownGames.filter((game: IGameStored) =>
          !getAttr(discoveredGames, game.id, { hidden: false }).hidden);

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

    supportedGameList.push(...gameExts.map(ext => ({
      id: ext.name,
      name: ext.gameName || ext.name,
      extensionPath: undefined,
      imageURL: ext.image,
      requiredFiles: [],
      executable: undefined,
      contributed: ext.author,
    }))
    .filter(ext => showHidden || !getAttr(discoveredGames, ext.id, { hidden: false }).hidden));

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

    const unmanagedGameList = [].concat(discoveredGameList, supportedGameList);

    const filteredManaged =
      managedGameList.filter(game => this.applyGameFilter(game)).sort(byGameName);
    const filteredUnmanaged =
        unmanagedGameList
        .filter(game => this.applyGameFilter(game)).sort(byGameName);

    const titleManaged = t('Managed ({{filterCount}})', {
      replace: { filterCount: this.getTabGameNumber(managedGameList, filteredManaged) } });
    const titleUnmanaged = t('Unmanaged ({{filterCount}})', {
      replace: { filterCount: this.getTabGameNumber(unmanagedGameList, filteredUnmanaged) } });

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
                <FormInput
                  className='game-filter-input'
                  value={currentFilterValue}
                  placeholder={t('Search for a game...')}
                  onChange={this.onFilterInputChange}
                  debounceTimer={100}
                  clearable
                />
              </InputGroup>
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <div ref={this.setScrollRef} className='gamepicker-body'>
                <PanelGroup id='game-panel-group'>
                  <Panel expanded={expandManaged} eventKey='managed' onToggle={nop}>
                    <Panel.Heading onClick={this.toggleManaged}>
                      <Icon name={expandManaged ? 'showhide-down' : 'showhide-right'} />
                      <Panel.Title>{titleManaged}</Panel.Title>
                    </Panel.Heading>
                    <Panel.Body collapsible>
                      {this.renderGames(filteredManaged, 'managed')}
                    </Panel.Body>
                  </Panel>
                  <Panel
                    expanded={expandUnmanaged}
                    eventKey='unmanaged'
                    onToggle={nop}
                  >
                    <Panel.Heading onClick={this.toggleUnmanaged}>
                      <Icon name={expandUnmanaged ? 'showhide-down' : 'showhide-right'} />
                      <Panel.Title>{titleUnmanaged}</Panel.Title>
                    </Panel.Heading>
                    <Panel.Body collapsible>
                      {this.renderGames(filteredUnmanaged, 'unmanaged')}
                      <EmptyPlaceholder
                        icon='in-progress'
                        text={t('Can\'t find the game you\'re looking for?')}
                        subtext={(
                          <a onClick={this.openGameExtWiki}>
                            {t('Your game may not be supported yet but adding it yourself '
                               + 'may be easier than you think. Click to learn how!')}
                          </a>
                        )}
                      />
                    </Panel.Body>
                  </Panel>
                </PanelGroup>
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

  private openGameExtWiki = () => {
    opn('https://wiki.nexusmods.com/index.php/Creating_a_game_extension_for_Vortex')
      .catch(() => null);
  }

  private toggleManaged = () => {
    this.nextState.expandManaged = !this.state.expandManaged;
  }

  private toggleUnmanaged = () => {
    this.nextState.expandUnmanaged = !this.state.expandUnmanaged;
  }

  private onFilterInputChange = (input) => {
    this.nextState.currentFilterValue = input;
  }

  private getTabGameNumber(unfiltered: IGameStored[], filtered: IGameStored[]): string {
    const { currentFilterValue } = this.state;
    return currentFilterValue ? `${filtered.length}/${unfiltered.length}` : `${unfiltered.length}`;
  }

  private applyGameFilter = (game: IGameStored): boolean => {
    const { currentFilterValue } = this.state;
    return game.name.toLowerCase().includes(currentFilterValue.toLowerCase())
        || !currentFilterValue;
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
    const { api } = this.context;
    api.events.emit('start-discovery');
  }

  private stopDiscovery = () => {
    this.context.api.events.emit('cancel-discovery');
  }

  private renderGames = (games: IGameStored[], type: string): JSX.Element => {
    const { t, gameMode, pickerLayout } = this.props;
    const { currentFilterValue } = this.state;

    if (games.length === 0) {
      if (truthy(currentFilterValue)) {
        return null;
      } else if (type === 'managed') {
        return (
          <EmptyPlaceholder
            icon='game'
            text={t('You haven\'t managed any games yet')}
            subtext={t('To start managing a game, go to "Unmanaged" and activate a game there.')}
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
          />
        ))
        }
      </ListGroup>
    );
  }

  private renderGamesSmall(games: IGameStored[], type: string, gameMode: string) {
    const { t, discoveredGames, onRefreshGameInfo } = this.props;

    const isDiscovered = (gameId: string) =>
      getSafe(discoveredGames, [gameId, 'path'], undefined) !== undefined;

    return (
      <div>
        <div className='game-group'>
          {games.map(game => (
            <GameThumbnail
              t={t}
              key={game.id + '_' + (game.contributed ?? 'official')}
              game={game}
              type={type}
              active={game.id === gameMode}
              onRefreshGameInfo={onRefreshGameInfo}
              getBounds={this.getBounds}
              container={this.mScrollRef}
              discovered={isDiscovered(game.id)}
            />
          ))
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
    extensions: state.session.extensions.available,
    extensionsInstalled: state.session.extensions.installed,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetPickerLayout: (layout) =>
      dispatch(setPickerLayout(layout)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)) as React.ComponentClass<{}>;
