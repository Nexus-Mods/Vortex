import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import FormInput from '../../../controls/FormInput';
import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import { ToggleButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import opn from '../../../util/opn';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { IAvailableExtension, IExtension } from '../../extension_manager/types';
import { nexusGameId } from '../../nexus_integration/util/convertGameId';
import { IProfile } from '../../profile_management/types/IProfile';

import { setPickerLayout, setSortManaged, setSortUnmanaged } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameRow from './GameRow';
import GameThumbnail from './GameThumbnail';
import ShowHiddenButton from './ShowHiddenButton';

import { IGameListEntry } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import { ratio } from 'fuzzball';
import update from 'immutability-helper';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { InputGroup, ListGroup, Panel, PanelGroup } from 'react-bootstrap';
import Select from 'react-select';

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

function captureClick(evt: React.MouseEvent) {
  evt.preventDefault();
}

function byGameName(lhs: IGameStored, rhs: IGameStored): number {
  return lhs.name.localeCompare(rhs.name);
}

interface IBaseProps {
  onRefreshGameInfo: (gameId: string) => Promise<void>;
  onBrowseGameLocation: (gameId: string) => Promise<void>;
  nexusGames: IGameListEntry[];
}

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  pickerLayout: 'list' | 'small' | 'large';
  extensions: IAvailableExtension[];
  extensionsInstalled: { [extId: string]: IExtension };
  sortManaged: string;
  sortUnmanaged: string;
}

interface IActionProps {
  onSetPickerLayout: (layout: 'list' | 'small' | 'large') => void;
  onSetSortManaged: (sorting: string) => void;
  onSetSortUnmanaged: (sorting: string) => void;
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
  // "PAYDAY 2" vs "Payday 2" or "Resident Evil: Village" vs "Resident Evil Village" are 100 similar
  // "Final Fantasy 7 Remake" vs "Final Fantasy VII Remake" are 91 similar
  public static SIMILARITY_RATIO: number = 90;
  public declare context: IComponentContext;

  private buttons: IActionDefinition[];
  private mRef: HTMLElement;
  private mScrollRef: HTMLElement;

  private nexusGameById = memoizeOne((gameList: IGameListEntry[]) =>
    gameList.reduce<{ [id: string]: IGameListEntry }>((prev, entry) => {
      prev[entry.domain_name] = entry; return prev; }, {}));

  private nexusGameByName = memoizeOne((gameList: IGameListEntry[]) =>
    gameList.reduce<{ [name: string]: IGameListEntry }>((prev, entry) => {
      prev[entry.name] = entry; return prev; }, {}));

  private mNameLookup: { [name: string]: string } = {};

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
    const { t, discoveredGames, extensions, extensionsInstalled, knownGames,
            pickerLayout, profiles, sortManaged, sortUnmanaged } = this.props;
    const { showHidden, currentFilterValue, expandManaged, expandUnmanaged } = this.state;

    const installedExtIds = new Set(Object.values(extensionsInstalled).map(ext => ext.modId));
    const installedNames = new Set(Object.values(extensionsInstalled).map(ext => ext.name));

    // figuring out if a manually installed extension corresponds to a remotely available extension
    // isn't trivial, because the unique id and the game name stored in the extension list are both
    // assigned by us, when we compile it, there is no id in the original author-provided info.json
    // because we can't rely on authors to be consistent here.
    // Therefore we will also filter out based on game name, meaning there can only be one entry
    // for each game name, the one installed locally taking precedence.
    const installedGameNames = new Set(knownGames.map(game => game.name.replace(/\t/g, ' ')));

    // contains the extensions we don't have installed locally
    const extensionsUninstalled = extensions
      .filter(ext => ext.type === 'game')
      .filter(ext => !installedExtIds.has(ext.modId)
                  && !installedNames.has(ext.name)
                  && !installedGameNames.has(ext.gameName));

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

    supportedGameList.push(...extensionsUninstalled.map(ext => ({
      id: ext.gameId || ext.name,
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
      managedGameList.filter(game => this.applyGameFilter(game)).sort(this.sortBy(sortManaged));
    const filteredUnmanaged =
        unmanagedGameList
        .filter(game => this.applyGameFilter(game)).sort(this.sortBy(sortUnmanaged));

    const titleManaged = t('Managed ({{filterCount}})', {
      replace: { filterCount: this.getTabGameNumber(managedGameList, filteredManaged) } });
    const titleUnmanaged = t('Unmanaged ({{filterCount}})', {
      replace: { filterCount: this.getTabGameNumber(unmanagedGameList, filteredUnmanaged) } });

    return (
      <MainPage domRef={this.setRef}>
        <MainPage.Header>
          <IconBar
            group='game-icons'
            staticElements={[]}
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
            <ShowHiddenButton
              t={this.props.t}
              showHidden={this.state.showHidden}
              toggleHidden={this.toggleHidden}
            />
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
              <Panel className='game-filter-container'>
                <Panel.Body>
                  <InputGroup>
                    <FormInput
                      className='game-filter-input'
                      value={currentFilterValue}
                      placeholder={t('Search for a game...')}
                      onChange={this.onFilterInputChange}
                      debounceTimer={100}
                      emptyIcon='search'
                      clearable
                    />
                  </InputGroup>
                </Panel.Body>
              </Panel>
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <div ref={this.setScrollRef} className='gamepicker-body'>
                <PanelGroup id='game-panel-group'>
                  <Panel expanded={expandManaged} eventKey='managed' onToggle={nop}>
                    <Panel.Heading onClick={this.toggleManaged}>
                      <Icon name={expandManaged ? 'showhide-down' : 'showhide-right'} />
                      <Panel.Title>{titleManaged}</Panel.Title>
                      <div className='flex-fill' />
                      {expandManaged ? (
                        <div className='game-sort-container' onClick={captureClick} >
                          {t('Sort by:')}
                          <Select
                            className='select-compact'
                            options={[
                              { value: 'alphabetical', label: t('Name A-Z') },
                              { value: 'recentlyused', label: t('Recently used') },
                            ]}
                            value={sortManaged}
                            onChange={this.setSortManaged}
                            clearable={false}
                            autosize={false}
                            searchable={false}
                          />
                        </div>
                      ) : null}
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
                      <div className='flex-fill' />
                      {expandUnmanaged ? (
                        <div className='game-sort-container' onClick={captureClick} >
                          {t('Sort by:')}
                          <Select
                            className='select-compact'
                            options={[
                              { value: 'popular', label: t('Most Popular') },
                              { value: 'alphabetical', label: t('Name A-Z') },
                              { value: 'recent', label: t('Most Recent') },
                            ]}
                            value={sortUnmanaged}
                            onChange={this.setSortUnmanaged}
                            clearable={false}
                            autosize={false}
                            searchable={false}
                          />
                        </div>
                      ) : null}
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
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private openGameExtWiki = () => {
    opn('https://nexus-mods.github.io/vortex-api/2022/04/03/Creating-a-game-extension.html')
      .catch(() => null);
  }

  private setSortManaged = (value: { value: string, label: string }) => {
    if (truthy(value)) {
      this.props.onSetSortManaged(value.value);
    }
  }

  private setSortUnmanaged = (value: { value: string, label: string }) => {
    if (truthy(value)) {
      this.props.onSetSortUnmanaged(value.value);
    }
  }

  private toggleManaged = (evt: React.MouseEvent<any>) => {
    if (!evt.isDefaultPrevented()) {
      this.nextState.expandManaged = !this.state.expandManaged;
    }
  }

  private toggleUnmanaged = (evt: React.MouseEvent<any>) => {
    if (!evt.isDefaultPrevented()) {
      this.nextState.expandUnmanaged = !this.state.expandUnmanaged;
    }
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

  private lastUsed(game: IGameStored): number {
    const { profiles } = this.props;
    return Math.max(...Object.values(profiles)
      .filter(prof => prof.gameId === game.id)
      .map(prof => prof.lastActivated));
  }

  private byRecentlyUsed = (lhs: IGameStored, rhs: IGameStored): number => {
    return this.lastUsed(rhs) - this.lastUsed(lhs);
  }

  private lookupName(input: string) {
    const { nexusGames } = this.props;
    if (this.mNameLookup[input] === undefined) {
      const exactMatch = nexusGames.find(i => i.name === input);
      if (exactMatch !== undefined) {
        this.mNameLookup[input] = input;
      } else {
        const sorted = nexusGames
          .map(item => ({ item, ratio: ratio(item.name, input) }))
          .filter(iter => iter.ratio > GamePicker.SIMILARITY_RATIO)
          .sort((lhs, rhs) => rhs.ratio - lhs.ratio);

        this.mNameLookup[input] = (sorted.length > 0)
           ? sorted[0].item.name
           : input;
      }
    }

    return this.mNameLookup[input];
  }

  private identifyGame(game: IGameStored): IGameListEntry {
    const { nexusGames } = this.props;
    return this.nexusGameById(nexusGames)[nexusGameId(game)]
        ?? this.nexusGameByName(nexusGames)[this.lookupName(game.name)];

  }

  private approvedTime(game: IGameStored): number {
    const nexusGame = this.identifyGame(game);
    return nexusGame?.approved_date ?? 0;
  }

  private byRecent = (lhs: IGameStored, rhs: IGameStored): number => {
    return this.approvedTime(rhs) - this.approvedTime(lhs);
  }

  private gameFileCount(game: IGameStored): number {
    const nexusGame = this.identifyGame(game);
    return nexusGame?.downloads ?? 0;
  }

  private byPopular = (lhs: IGameStored, rhs: IGameStored): number => {
    return this.gameFileCount(rhs) - this.gameFileCount(lhs);
  }

  private sortBy = (sortMode: string) => {
    return {
      recentlyused: this.byRecentlyUsed,
      recent: this.byRecent,
      popular: this.byPopular,
    }[sortMode] ?? byGameName;
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
    extensions: state.session.extensions.available,
    extensionsInstalled: state.session.extensions.installed,
    sortManaged: state.settings.gameMode.sortManaged ?? 'alphabetical',
    sortUnmanaged: state.settings.gameMode.sortUnmanaged ?? 'alphabetical',
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetPickerLayout: (layout) =>
      dispatch(setPickerLayout(layout)),
    onSetSortManaged: (sorting: string) => dispatch(setSortManaged(sorting)),
    onSetSortUnmanaged: (sorting: string) => dispatch(setSortUnmanaged(sorting)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)) as React.ComponentClass<{}>;
