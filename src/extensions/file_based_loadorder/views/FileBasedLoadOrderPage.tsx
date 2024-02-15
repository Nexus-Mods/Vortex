/* eslint-disable */
import * as _ from 'lodash';
import * as React from 'react';
import { Panel } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import * as actions from '../../../actions/index';
import { DraggableList, EmptyPlaceholder, FlexLayout, IconBar, Spinner, ToolbarIcon } from '../../../controls/api';
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';
import { DNDContainer, MainPage } from '../../../views/api';

import { setFBLoadOrder } from '../actions/loadOrder';
import { IItemRendererProps, ILoadOrderGameInfo, LoadOrder,
  LoadOrderValidationError } from '../types/types';
import InfoPanel from './InfoPanel';
import ItemRenderer from './ItemRenderer';

const PanelX: any = Panel;

interface IBaseState {
  loading: boolean;
  updating: boolean;
  validationError: LoadOrderValidationError;
  currentRefreshId: string;
}

export interface IBaseProps {
  getGameEntry: (gameId: string) => ILoadOrderGameInfo;
  onStartUp: (gameMode: string) => Promise<LoadOrder>;
  onShowError: (gameId: string, error: Error) => void;
  validateLoadOrder: (profile: types.IProfile, newLO: LoadOrder) => Promise<void>;
}

interface IConnectedProps {
  // The current loadorder
  loadOrder: LoadOrder;

  // The profile we're managing this load order for.
  profile: types.IProfile;

  // Does the user need to deploy ?
  needToDeploy: boolean;

  // The refresh id for the current profile
  //  (used to force a refresh of the list)
  refreshId: string;
}

interface IActionProps {
  onSetDeploymentNecessary: (gameId: string, necessary: boolean) => void;
  onSetOrder: (profileId: string, loadOrder: LoadOrder) => void;
}

type IProps = IActionProps & IBaseProps & IConnectedProps;
type IComponentState = IBaseState;

class FileBasedLoadOrderPage extends ComponentEx<IProps, IComponentState> {
  private mStaticButtons: types.IActionDefinition[];

  constructor(props: IProps) {
    super(props);
    this.initState({
      loading: true,
      updating: false,
      validationError: undefined,
      currentRefreshId: '',
    });

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
            id: 'btn-purge-list',
            key: 'btn-purge-list',
            icon: 'purge',
            text: 'Purge Mods',
            className: 'load-order-purge-list',
            onClick: () => this.context.api.events.emit('purge-mods', false, () => undefined),
          };
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
    // Zuckerberg isn't going to like this...
    if (this.state.currentRefreshId !== newProps.refreshId) {
      this.onRefreshList();
      this.nextState.currentRefreshId = newProps.refreshId;
    }
  }

  public componentDidMount() {
    const { onSetOrder, onStartUp, profile } = this.props;
    onStartUp(profile?.gameId)
      .then(lo => {
        if (lo !== undefined) {
          onSetOrder(profile.id, lo);
        }
      })
      .catch(err => {
        // The deserialized loadorder failed validation; although invalid
        //  we still want to give the user the ability to modify the LO
        //  to a valid state through the UI rather than force him to do
        //  so manually, which is why we're updating the loadorder state.
        //  Fortunately the lo will fail validation when serialized unless
        //  a valid LO is provided.
        this.nextState.validationError = err as LoadOrderValidationError;
        onSetOrder(profile.id, (err as LoadOrderValidationError).loadOrder);
      })
      .finally(() => this.nextState.loading = false);
  }

  public componentWillUnmount() {
    this.resetState();
  }

  public render(): JSX.Element {
    const { t, loadOrder, getGameEntry, profile } = this.props;
    const { validationError } = this.state;
    const gameEntry = getGameEntry(profile?.gameId);
    const chosenItemRenderer = gameEntry.customItemRenderer ?? ItemRenderer;
    const enabled = (gameEntry !== undefined)
      ? loadOrder.reduce((accum, loEntry) => {
          const rendOps: IItemRendererProps = {
            loEntry,
            displayCheckboxes: gameEntry.toggleableEntries || false,
            invalidEntries: validationError?.validationResult?.invalid,
          };
          accum.push(rendOps);
          return accum;
        }, [])
      : [];

    const infoPanel = () =>
      <InfoPanel
        validationError={validationError}
        info={gameEntry?.usageInstructions}
      />;

    const draggableList = () => (this.nextState.loading || this.nextState.updating)
      ? this.renderWait()
      : (enabled.length > 0)
        ? <DraggableList
            itemTypeId='file-based-lo-draggable-entry'
            id='mod-loadorder-draggable-list'
            items={enabled}
            itemRenderer={chosenItemRenderer}
            apply={this.onApply}
            idFunc={this.getItemId}
            isLocked={this.isLocked}
        />
        : <EmptyPlaceholder
            icon='folder-download'
            fill={true}
            text={t('You don\'t have any orderable entries')}
            subtext={t('Please make sure to deploy')}
        />;

    return (
      <MainPage>
        <MainPage.Header>
          <IconBar
            group='fb-load-order-icons'
            staticElements={this.mStaticButtons}
            className='menubar'
            t={t}
          />
        </MainPage.Header>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <DNDContainer style={{ height: '100%' }}>
                <FlexLayout type='row' className='file-based-load-order-container'>
                  <FlexLayout.Flex className='file-based-load-order-list'>
                    {draggableList()}
                  </FlexLayout.Flex>
                  <FlexLayout.Flex>
                    {infoPanel()}
                  </FlexLayout.Flex>
                </FlexLayout>
              </DNDContainer>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private resetState() {
    this.nextState.loading = true;
    this.nextState.validationError = undefined;
  }

  private renderWait() {
    return (
      <div className='fblo-spinner-container'>
        <Spinner className='file-based-load-order-spinner'/>
      </div>
    );
  }

  private getItemId = (item: IItemRendererProps): string => item.loEntry.id;

  private isLocked = (item: IItemRendererProps): boolean => {
    return [true, 'true', 'always'].includes(item.loEntry.locked);
  }

  private onApply = (ordered: IItemRendererProps[]) => {
    const { onSetOrder, onShowError, loadOrder, profile, validateLoadOrder } = this.props;
    const newLO = ordered.map(item => item.loEntry);
    validateLoadOrder(profile, newLO)
      .then(() => this.nextState.validationError = undefined)
      .catch(err => {
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err;
        } else {
          onShowError(profile.gameId, err);
        }
      })
      // Regardless of whether the lo is valid or not, we still want it
      //  displayed to the user to give them a chance to fix it from inside
      //  Vortex (if possible)
      .finally(() => onSetOrder(profile.id, newLO));
  }

  private onRefreshList = () => {
    const { onStartUp, onSetOrder, profile } = this.props;
    this.nextState.updating = true;
    onStartUp(profile?.gameId)
      .then(lo => {
        this.nextState.validationError = undefined;
        onSetOrder(profile.id, lo);
      })
      .catch(err => {
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err as LoadOrderValidationError;
          onSetOrder(profile.id, err.loadOrder);
        }
      })
      .finally(() => this.nextState.updating = false);
  }
}

function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile?.id], []);
  if (!Array.isArray(loadOrder)) {
    loadOrder = [];
  }
  return {
    loadOrder,
    profile,
    needToDeploy: selectors.needToDeploy(state),
    refreshId: util.getSafe(state, ['session', 'fblo', 'refresh', profile?.id], ''),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetDeploymentNecessary: (gameId, necessary) =>
      dispatch(actions.setDeploymentNecessary(gameId, necessary)),
    onSetOrder: (profileId, loadOrder) => {
      dispatch(setFBLoadOrder(profileId, loadOrder));
    },
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    FileBasedLoadOrderPage) as any) as React.ComponentClass<{}>;
