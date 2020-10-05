import * as _ from 'lodash';
import * as React from 'react';
import { Panel } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import * as actions from '../../../actions/index';
import { FlexLayout, IconBar, Spinner, ToolbarIcon } from '../../../controls/api';
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';
import { DNDContainer, MainPage } from '../../../views/api';

import { setGameLoadOrderRendererOptions } from '../actions/settings';

import { IGameLoadOrderEntry, IItemRendererOptions, ILoadOrder,
  ILoadOrderDisplayItem, SortType, UpdateType } from '../types/types';

import DraggableList from './DraggableList';

import DefaultInfoPanel from './DefaultInfoPanel';
import DefaultItemRenderer from './DefaultItemRenderer';

const PanelX: any = Panel;

const NAMESPACE: string = 'generic-load-order-extension';

interface IBaseState {
  i18nNamespace: string;
  loading: boolean;
  updating: boolean;
  sortType: SortType;
  itemRenderer: React.ComponentClass<{
    className?: string,
    item: ILoadOrderDisplayItem,
    onRef: (ref: any) => any }>;
}

export interface IBaseProps {
  // The currently managed game information.
  getGameEntry: (gameId: string) => IGameLoadOrderEntry;
}

interface IConnectedProps {
  // The current loadorder
  loadOrder: ILoadOrder;

  // All available mods for this gameMode.
  mods: types.IMod[];

  // The profile we're managing this load order for.
  profile: types.IProfile;

  // Does the user need to deploy ?
  needToDeploy: boolean;

  // ItemRenderer options.
  itemRendererOptions: IItemRendererOptions;
}

interface IActionProps {
  onSetLoadOrderRendererOptions: (gameId: string, options: IItemRendererOptions) => void;
  onSetDeploymentNecessary: (gameId: string, necessary: boolean) => void;
  onSetOrder: (profileId: string, loadOrder: ILoadOrder) => void;
}

interface ILoadOrderState {
  enabled: ILoadOrderDisplayItem[];
}

type IProps = IActionProps & IBaseProps & IConnectedProps;
type IComponentState = IBaseState & ILoadOrderState;

class LoadOrderPage extends ComponentEx<IProps, IComponentState> {
  private mCallbackDebouncer: util.Debouncer;
  private mUpdateDebouncer: util.Debouncer;
  private mForceUpdateDebouncer: util.Debouncer;
  private mStaticButtons: types.IActionDefinition[];

  constructor(props: IProps) {
    super(props);
    this.initState({
      enabled: [],
      sortType: 'ascending',
      loading: true,
      updating: false,
      itemRenderer: undefined,
      i18nNamespace: undefined,
    });

    this.mUpdateDebouncer = new util.Debouncer(() => {
      const { enabled } = this.state;
      const updateType: UpdateType = 'refresh';
      this.setLoadOrder(enabled, updateType);
      this.mCallbackDebouncer.schedule(undefined, updateType);
      this.nextState.updating = false;
      return null;
    }, 500);

    this.mCallbackDebouncer = new util.Debouncer((updateType: UpdateType) => {
      const { loadOrder, profile, getGameEntry } = this.props;
      if (profile === undefined) {
        return null;
      }

      const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
      if (!!activeGameEntry.callback) {
        activeGameEntry.callback(loadOrder, updateType);
      }

      return null;
    }, 500);

    this.mForceUpdateDebouncer = new util.Debouncer(() => {
      this.nextState.updating = true;
      this.updateState(this.props, true, 'refresh');
      return null;
    }, 200, false, true);

    this.mStaticButtons = [
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: 'btn-deploy',
            key: 'btn-deploy',
            icon: 'deploy',
            text: 'Deploy Mods',
            className: this.props.needToDeploy ? 'toolbar-flash-button' : undefined,
            onClick: () => this.context.api.events.emit('deploy-mods', () => undefined),
          };
        },
      }, {
        component: ToolbarIcon,
        props: () => {
          return {
            id: 'btn-sort-direction',
            key: 'btn-sort-direction',
            icon: (this.state.sortType === 'ascending') ? 'sort-down' : 'sort-up',
            text: (this.state.sortType === 'ascending') ? 'Sort Descending' : 'Sort Ascending',
            className: 'load-order-sort-direction',
            onClick: () => {
              this.nextState.sortType = (this.state.sortType === 'ascending')
                ? 'descending' : 'ascending';
              this.mForceUpdateDebouncer.schedule();
            },
          };
        },
      }, {
        component: ToolbarIcon,
        props: () => {
          return {
            id: 'btn-select-list-view',
            key: 'btn-select-list-view',
            icon: 'layout-list',
            text: (this.props.itemRendererOptions.listViewType === 'full') ? 'Compact View' : 'Full View',
            className: 'load-order-list-view',
            onClick: this.onChangeViewType,
          };
        },
        condition: () => {
          return this.state.itemRenderer === DefaultItemRenderer;
        },
      }, {
        component: ToolbarIcon,
        props: () => {
          return {
            id: 'btn-refresh-list',
            key: 'btn-refresh-list',
            icon: this.state.updating ? 'spinner' : 'refresh',
            text: 'Refresh List',
            className: 'load-order-refresh-list',
            onClick: this.onRefreshList,
          };
        },
      },
    ];
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.state.updating === true) {
      return;
    }

    if ((this.stringified(this.props.loadOrder) !== this.stringified(newProps.loadOrder))
        || (this.stringified(this.props.mods) !== this.stringified(newProps.mods))
        || (this.stringified(this.props.profile) !== this.stringified(newProps.profile))) {
      const updateLO: boolean = ((this.props.profile === newProps.profile)
        && (this.stringified(this.props.loadOrder) !== this.stringified(newProps.loadOrder)));
      this.updateState(newProps, updateLO);
    }
  }

  public componentDidMount() {
    const renderer = this.getItemRenderer();
    if (renderer !== this.state.itemRenderer) {
      this.nextState.itemRenderer = renderer;
    }

    this.updateState(this.props);
    this.nextState.loading = false;
  }

  public componentWillUnmount() {
    this.resetState();
  }

  public render(): JSX.Element {
    const { loading } = this.state;
    return (loading)
      ? this.renderWait()
      : this.renderLoadOrderPage();
  }

  private stringified(obj: any) {
    return (!!obj) ? JSON.stringify(obj) : obj;
  }

  private resetState() {
    this.nextState.loading = true;
    this.nextState.updating = false;
    this.nextState.itemRenderer = undefined;
    this.nextState.i18nNamespace = undefined;
    this.nextState.enabled = [];
  }

  private setLoadOrder(list: ILoadOrderDisplayItem[], update: UpdateType) {
    this.nextState.updating = true;
    const { loadOrder, onSetOrder, profile, getGameEntry } = this.props;
    const loKeys = Object.keys(loadOrder);

    const hasLOEntry = (modId) => loKeys.includes(modId);
    const setNewOrder = (newList: ILoadOrderDisplayItem[]) => {
      const locked = loKeys.filter(key => !!loadOrder[key]?.locked);
      const newOrder: ILoadOrder = newList.reduce((accum, entry, idx) => {
        if (loKeys.length === 0) {
          // First run
          accum[entry.id] = {
            pos: idx,
            enabled: true,
            locked: false,
            prefix: entry.prefix,
          };
          return accum;
        }
        if (locked.includes(entry.id)) {
          accum[entry.id] = {
            pos: loadOrder[entry.id].pos,
            enabled: loadOrder[entry.id].enabled,
            locked: true,
            prefix: entry.prefix,
          };
        } else {
          const existing = Object.keys(accum);
          const wantedPos = idx;
          const posTaken = existing.find(key => accum[key].pos === wantedPos) !== undefined;
          if (posTaken) {
            const sorted = existing.sort((a, b) => accum[a].pos - accum[b].pos);
            let previousPos = 0;
            for (const element of sorted) {
              if (accum[element].pos !== previousPos + 1) {
                accum[entry.id] = {
                  pos: previousPos + 1,
                  enabled: hasLOEntry(entry.id) ? loadOrder[entry.id].enabled : true,
                  locked: false,
                  prefix: entry.prefix,
                };
                return accum;
              }
              previousPos = accum[element].pos;
            }

            accum[entry.id] = {
              pos: previousPos + 1,
              enabled: hasLOEntry(entry.id) ? loadOrder[entry.id].enabled : true,
              locked: false,
              prefix: entry.prefix,
            };
          } else {
            accum[entry.id] = {
              pos: wantedPos,
              enabled: hasLOEntry(entry.id) ? loadOrder[entry.id].enabled : true,
              locked: false,
              prefix: entry.prefix,
            };
          }
        }

        return accum;
      }, {});

      const sortedList = newList.sort((a, b) => newOrder[a.id].pos - newOrder[b.id].pos);
      if (JSON.stringify(sortedList) !== JSON.stringify(this.state.enabled)) {
        // Just in case the component's state is out of sync for some
        //  reason - this will trigger a re-render unfortunately.
        this.nextState.enabled = sortedList;
      }

      if (JSON.stringify(newOrder) === JSON.stringify(loadOrder)) {
        // Nothing changed, go home load order page, you're drunk.
        return;
      }

      onSetOrder(profile.id, newOrder);
    };

    const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
    if (!!activeGameEntry.preSort) {
      activeGameEntry.preSort(list, this.state.sortType, update).then(newList =>
        !!newList ? setNewOrder(newList) : setNewOrder(list));
    } else {
      setNewOrder(list);
    }
  }

  // If the itemRenderer hasn't been assigned yet or is different than the
  //  one that the game extension provided - assign the default item renderer.
  private getItemRenderer() {
    const { getGameEntry, profile, onSetLoadOrderRendererOptions,
            itemRendererOptions } = this.props;
    const { itemRenderer } = this.state;

    if (profile === undefined) {
      return undefined;
    }

    const useDefault = (gameEntry: IGameLoadOrderEntry) => {
      onSetLoadOrderRendererOptions(profile.gameId, {
        displayCheckboxes: (gameEntry?.displayCheckboxes === false) ? false : true,
        listViewType: (!!itemRendererOptions?.listViewType)
          ? itemRendererOptions.listViewType
          : 'full',
      });
      return DefaultItemRenderer;
    };

    const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
    if (activeGameEntry === undefined) {
      // There's no game entry for this game; that's expected for games
      //  which do not use the LO page.
      return undefined;
    }
    if ((itemRenderer === undefined) && (activeGameEntry.itemRenderer === undefined)) {
      return useDefault(activeGameEntry);
    }

    return (!!activeGameEntry.itemRenderer)
      ? activeGameEntry.itemRenderer : useDefault(activeGameEntry);
  }

  private renderLoadOrderPage(): JSX.Element {
    const { t, getGameEntry, profile, loadOrder } = this.props;
    const { enabled, itemRenderer } = this.state;

    const enabledIds = enabled.map(mod => mod.id);
    const loadOrderIds = Object.keys(loadOrder);
    const difference = enabledIds.filter(x =>
      loadOrderIds.find(mod => mod === x) === undefined);
    if (difference.length !== 0) {
      this.mUpdateDebouncer.schedule();
      return null;
    }

    const activeGameEntry = (profile !== undefined) ? getGameEntry(profile.gameId) : undefined;
    if (activeGameEntry === undefined) {
      return null;
    }

    const res = activeGameEntry.createInfoPanel({
      refresh: () => this.mForceUpdateDebouncer.schedule(),
    });

    const infoPanel = (typeof(res) === 'string')
      ? <DefaultInfoPanel infoText={res} />
      : res;

    const sorted = (this.state.sortType === 'ascending')
      ? enabled.sort((lhs, rhs) => loadOrder[lhs.id].pos - loadOrder[rhs.id].pos)
      : enabled.sort((lhs, rhs) => loadOrder[rhs.id].pos - loadOrder[lhs.id].pos);
    return (!!sorted)
      ? (
      <MainPage>
        <MainPage.Header>
          <IconBar
            group='generic-load-order-icons'
            staticElements={this.mStaticButtons}
            className='menubar'
            t={t}
          />
        </MainPage.Header>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <DNDContainer style={{ height: '100%' }}>
                <FlexLayout type='row'>
                  <FlexLayout.Flex>
                    <DraggableList
                      id='mod-loadorder-draggable-list'
                      itemRenderer={itemRenderer}
                      loadOrder={loadOrder}
                      items={sorted}
                      apply={this.onApply}
                    />
                  </FlexLayout.Flex>
                  <FlexLayout.Flex>
                    {infoPanel}
                  </FlexLayout.Flex>
                </FlexLayout>
              </DNDContainer>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    ) : null;
  }

  private onApply = (ordered: ILoadOrderDisplayItem[]) => {
    const updateType: UpdateType = 'drag-n-drop';
    this.setLoadOrder(ordered, updateType);
    this.mCallbackDebouncer.schedule(undefined, updateType);
    this.nextState.updating = false;
  }

  private onChangeViewType = () => {
    const { onSetLoadOrderRendererOptions, profile, itemRendererOptions } = this.props;
    const newOpts: IItemRendererOptions = {
      displayCheckboxes: itemRendererOptions.displayCheckboxes,
      listViewType: (itemRendererOptions.listViewType === 'full')
        ? 'compact' : 'full',
    };

    onSetLoadOrderRendererOptions(profile.gameId, newOpts);
  }

  private onRefreshList = () => {
    this.mForceUpdateDebouncer.schedule();
  }

  private renderWait() {
    return (
      <Spinner
        style={{
          width: '64px',
          height: '64px',
        }}
      />
    );
  }

  private updateState(props: IProps,
                      updateLO: boolean = false,
                      updateType: UpdateType = null) {
    const { getGameEntry, mods, profile } = props;
    const activeGameEntry = getGameEntry(profile.gameId);
    if (activeGameEntry === undefined) {
      // User may have switched to a game which does not use
      //  the generic load order extension. In this case we just
      //  return.
      return;
    }

    const mapToDisplay = (mod: types.IMod): ILoadOrderDisplayItem => ({
      id: mod.id,
      name: (mod?.attributes !== undefined) ? util.renderModName(mod) : mod.id,
      imgUrl: (mod?.attributes?.pictureUrl !== undefined)
        ? mod.attributes.pictureUrl
        : activeGameEntry.gameArtURL,
    });

    const modState = Object.keys(mods).filter(mod =>
      util.getSafe(profile, ['modState', mod, 'enabled'], false));

    const filtered = (!!activeGameEntry.filter)
      ? activeGameEntry.filter(modState.map(id => mods[id])).map(mod => mapToDisplay(mod))
      : modState.map(mod => mapToDisplay(mods[mod]));

    const en = this.state.enabled.filter(mod =>
      filtered.find(entry => entry.id === mod.id) !== undefined);

    const difference = filtered.filter(x =>
      en.find(mod => mod.id === x.id) === undefined);

    const spread = [ ...en, ...difference ];

    updateType = (updateType !== null) ? updateType : 'props-update';
    const update = (newDisplayItems: ILoadOrderDisplayItem[]) => {
      if (updateLO || (this.stringified(spread) !== this.stringified(newDisplayItems))) {
        this.setLoadOrder(newDisplayItems, updateType);
        this.mCallbackDebouncer.schedule(undefined, updateType);
        this.nextState.updating = false;
      }
    };

    if (!!activeGameEntry.preSort) {
      activeGameEntry.preSort(spread, this.state.sortType, updateType)
        .then(newList => {
          const wantedList = (!!newList) ? newList : spread;
          this.nextState.enabled = wantedList;
          update(wantedList);
        });
    } else {
      this.nextState.enabled = spread;
      update(spread);
    }
  }
}

const empty = {};
const defaultOpts: IItemRendererOptions = { listViewType: 'full', displayCheckboxes: true };
function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder: ILoadOrder = {};

  let itemRendererOptions: IItemRendererOptions = defaultOpts;
  if (!!profile?.gameId) {
    loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile.id], empty);
    itemRendererOptions = util.getSafe(state,
      ['settings', 'loadOrder', 'rendererOptions', profile.gameId], defaultOpts);
  }

  return {
    itemRendererOptions,
    loadOrder,
    mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], []),
    profile,
    needToDeploy: selectors.needToDeploy(state),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetLoadOrderRendererOptions: (gameId, options) =>
      dispatch(setGameLoadOrderRendererOptions(gameId, options)),
    onSetDeploymentNecessary: (gameId, necessary) =>
      dispatch(actions.setDeploymentNecessary(gameId, necessary)),
    onSetOrder: (profileId, loadOrder) => {
      dispatch(actions.setLoadOrder(profileId, (loadOrder as any)));
    },
  };
}

export default withTranslation(['common', NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(
    LoadOrderPage) as any) as React.ComponentClass<{}>;
