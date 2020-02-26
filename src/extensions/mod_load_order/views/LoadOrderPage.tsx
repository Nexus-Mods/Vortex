import * as _ from 'lodash';
import * as React from 'react';
import { Panel } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { actions, ComponentEx, DNDContainer,
  FlexLayout, MainPage, selectors, Spinner, types, util } from 'vortex-api';

import { IGameLoadOrderEntry, ILoadOrder,
  ILoadOrderDisplayItem } from '../types/types';

import DraggableList from './DraggableList';

import DefaultItemRenderer from './DefaultItemRenderer';
import { currentActivator } from '../../../util/selectors';

const PanelX: any = Panel;

interface IBaseState {
  i18nNamespace: string;
  loading: boolean;
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

  constructor(props: IProps) {
    super(props);
    this.initState({
      enabled: [],
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
    }, 2000);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.loadOrder !== newProps.loadOrder)
        || (this.props.mods !== newProps.mods)
        || (this.props.profile !== newProps.profile)) {
      this.updateState(newProps);
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
    };

    const activeGameEntry: IGameLoadOrderEntry = getGameEntry(profile.gameId);
    if (!!activeGameEntry.preSort) {
      activeGameEntry.preSort(list).then(newList => setNewOrder(newList));
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
    const { enabled, itemRenderer, i18nNamespace } = this.state;

    const enabledIds = enabled.map(mod => mod.id);
    const loadOrderIds = Object.keys(loadOrder);
    const difference = enabledIds.filter(x =>
      loadOrderIds.find(mod => mod === x) === undefined);
    if (difference.length !== 0) {
      this.mUpdateDebouncer.schedule();
      return null;
    }

    const activeGameEntry = (profile !== undefined) ? getGameEntry(profile.gameId) : undefined;
    const sorted = enabled.sort((lhs, rhs) => loadOrder[lhs.id].pos - loadOrder[rhs.id].pos);
    return ((activeGameEntry !== undefined) && !!sorted)
      ? (
      <MainPage>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <DNDContainer style={{ height: '100%' }}>
                <FlexLayout type='row'>
                  <FlexLayout.Flex>
                    <DraggableList
                      id='mod-loadorder'
                      itemRenderer={itemRenderer}
                      items={sorted}
                      apply={this.onApply}
                    />
                  </FlexLayout.Flex>
                  <FlexLayout.Flex>
                    <div id='loadorderinfo'>
                      <h2>{t('Changing your load order', { ns: i18nNamespace })}</h2>
                      <p>{activeGameEntry.loadOrderInfo}</p>
                    </div>
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
      <div className='spinner'>
        <Spinner
          style={{
            width: '64px',
            height: '64px',
          }}
        />
      </div>
    );
  }

  private updateState(props: IProps) {
    const { getGameEntry, mods, profile, loadOrder } = props;
    const activeGameEntry = getGameEntry(profile.gameId);

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

    const missing = Object.keys(loadOrder)
      .filter(lo => filtered.find(fil => fil.id === lo) === undefined);

    // const id = (missing.length > 0)
    //   ? (missing.length > 1)
    //     ? `${missing[0] + '-' + missing[missing.length - 1]}`
    //     : `${missing[0]}`
    //   : undefined;

    const en = this.state.enabled.filter(mod =>
      filtered.find(entry => entry.id === mod.id) !== undefined);

    const difference = filtered.filter(x =>
      en.find(mod => mod.id === x.id) === undefined);

    const spread = [ ...en, ...difference ];
    // const spread = (id !== undefined)
    //   ? [ ...en, ...difference, ({ id, name: id, imgUrl: activeGameEntry.gameArtURL }) ]
    //   : [ ...en, ...difference ];

    (!!activeGameEntry.preSort)
      ? activeGameEntry.preSort(spread).then(newList => this.nextState.enabled = newList)
      : this.nextState.enabled = spread;

    this.mCallbackDebouncer.schedule();
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

export default withTranslation(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    LoadOrderPage) as any) as React.ComponentClass<{}>;
