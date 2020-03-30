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

import { IGameLoadOrderEntry, ILoadOrder,
  ILoadOrderDisplayItem, SortType } from '../types/types';

import DraggableList from './DraggableList';

import DefaultInfoPanel from './DefaultInfoPanel';
import DefaultItemRenderer from './DefaultItemRenderer';

const PanelX: any = Panel;

const NAMESPACE: string = 'generic-load-order-extension';

interface IBaseState {
  i18nNamespace: string;
  loading: boolean;
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
}

interface IActionProps {
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
      loading: false,
      itemRenderer: undefined,
      i18nNamespace: undefined,
    });

    this.mUpdateDebouncer = new util.Debouncer(() => {
      const { enabled } = this.state;
      this.setLoadOrder(enabled);

      return null;
    }, 500);

    this.mCallbackDebouncer = new util.Debouncer(() => {
      const { loadOrder, profile, getGameEntry } = this.props;
      if (profile === undefined) {
        return null;
      }

      const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
      if (!!activeGameEntry.callback) {
        activeGameEntry.callback(loadOrder);
      }

      return null;
    }, 500);

    this.mForceUpdateDebouncer = new util.Debouncer(() => {
      this.updateState(this.props);
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
            className: this.props.needToDeploy ? 'need-to-deploy' : 'no-deploy',
            onClick: () => this.context.api.events.emit('deploy-mods', () => undefined),
          };
        },
      },
      {
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
      },
    ];
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.loadOrder !== newProps.loadOrder)
        || (this.props.mods !== newProps.mods)
        || (this.props.profile !== newProps.profile)) {
      const updateLO: boolean = ((this.props.profile === newProps.profile)
        && (this.props.mods !== newProps.mods));
      this.updateState(newProps, updateLO);
    }
  }

  public componentDidMount() {
    this.updateState(this.props);
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

  private resetState() {
    this.nextState.loading = true;
    this.nextState.itemRenderer = undefined;
    this.nextState.i18nNamespace = undefined;
    this.nextState.enabled = [];
  }

  private setLoadOrder(list: ILoadOrderDisplayItem[]) {
    const { onSetDeploymentNecessary, onSetOrder, profile, getGameEntry } = this.props;

    const setNewOrder = (newList: ILoadOrderDisplayItem[]) => {
      const newOrder: ILoadOrder = {};
      newList.forEach((item, idx) => newOrder[item.id] = { pos: idx, enabled: true });
      onSetOrder(profile.id, newOrder);
      onSetDeploymentNecessary(profile.gameId, true);
      this.mCallbackDebouncer.schedule();
    };

    const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
    if (!!activeGameEntry.preSort) {
      activeGameEntry.preSort(list, this.state.sortType).then(newList =>
        !!newList ? setNewOrder(newList) : setNewOrder(list));
    } else {
      setNewOrder(list);
    }
  }

  // If the itemRenderer hasn't been assigned yet or is different than the
  //  one that the game extension provided - assign the default item renderer.
  private getItemRenderer() {
    const { getGameEntry, profile } = this.props;
    const { itemRenderer } = this.state;

    if (profile === undefined) {
      return undefined;
    }

    const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);

    return ((itemRenderer === undefined) && (activeGameEntry.itemRenderer === undefined))
      || ((!!activeGameEntry.itemRenderer) && (activeGameEntry.itemRenderer !== itemRenderer))
          ? DefaultItemRenderer : itemRenderer;
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
    this.setLoadOrder(ordered);
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

  private updateState(props: IProps, updateLO: boolean = false) {
    const { getGameEntry, mods, profile } = props;
    const activeGameEntry = getGameEntry(profile.gameId);
    if (activeGameEntry === undefined) {
      // User may have switched to a game which does not use
      //  the generic load order extension. In this case we just
      //  return.
      return;
    }

    const renderer = this.getItemRenderer();
    if (renderer !== this.state.itemRenderer) {
      this.nextState.itemRenderer = renderer;
    }

    const mapToDisplay = (mod: types.IMod): ILoadOrderDisplayItem => ({
      id: mod.id,
      name: !!mod.attributes ? util.renderModName(mod) : mod.id,
      imgUrl: (!!mod.attributes.pictureUrl)
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

    (!!activeGameEntry.preSort)
      ? activeGameEntry.preSort(spread, this.state.sortType).then(newList =>
          this.nextState.enabled = (!!newList) ? newList : spread)
      : this.nextState.enabled = spread;

    if (updateLO) {
      this.setLoadOrder(this.nextState.enabled);
    }
  }
}

function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  const loadOrder = (!!profile)
    ? util.getSafe(state, ['persistent', 'loadOrder', profile.id], {})
    : {};

  return {
    loadOrder,
    mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], []),
    profile,
    needToDeploy: selectors.needToDeploy(state),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
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
