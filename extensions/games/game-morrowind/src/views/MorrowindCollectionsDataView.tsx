import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { ComponentEx, EmptyPlaceholder, FlexLayout, Icon,
  selectors, types, util } from 'vortex-api';

import { IExtendedInterfaceProps, ILoadOrderEntry } from '../types/types';

import { NATIVE_PLUGINS } from '../constants';

import { deserializeLoadOrder } from '../loadorder';

const NAMESPACE: string = 'game-morrowind';

interface IBaseState {
  sortedMods: ILoadOrderEntry[];
}

interface IBaseProps {
  api: types.IExtensionApi;
}

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: ILoadOrderEntry[];
  profile: types.IProfile;
}

interface IActionProps {
}

type IProps = IBaseProps & IActionProps & IExtendedInterfaceProps & IConnectedProps;
type IComponentState = IBaseState;

class MorrowindCollectionsDataView extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      sortedMods: [],
    });
  }

  public componentDidMount() {
    this.updateSortedMods();
  }

  public componentDidUpdate(prevProps: IProps, prevState: IBaseState): void {
    if (JSON.stringify(this.state.sortedMods) !== JSON.stringify(this.props.loadOrder)){
      this.updateSortedMods();
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { sortedMods } = this.state;
    return (!!sortedMods && Object.keys(sortedMods).length !== 0)
      ? (
        <div style={{ overflow: 'auto' }}>
          <h4>{t('Load Order')}</h4>
          <p>
          {t('This is a snapshot of the load order information that '
           + 'will be exported with this collection.')}
          </p>
          {this.renderLoadOrderEditInfo()}
          <ListGroup id='collections-load-order-list'>
            {sortedMods.map((entry, idx) => this.renderModEntry(entry, idx))}
          </ListGroup>
        </div>
    ) : this.renderPlaceholder();
  }

  private updateSortedMods() {
    const includedModIds = (this.props.collection?.rules || []).map(rule => rule.reference.id);
    const mods = Object.keys(this.props.mods).reduce((accum, iter) => {
      if (includedModIds.includes(iter)) {
        accum[iter] = this.props.mods[iter];
      }
      return accum;
    }, {})
    deserializeLoadOrder(this.props.api, mods)
      .then(lo => {
        const filtered = lo.filter(entry => (NATIVE_PLUGINS.includes(entry.id) || entry.modId !== undefined));
        this.nextState.sortedMods = filtered;
      })
  }

  private renderLoadOrderEditInfo = () => {
    const { t } = this.props;
    return (
      <FlexLayout type='row' id='collection-edit-loadorder-edit-info-container'>
        <FlexLayout.Fixed className='loadorder-edit-info-icon'>
          <Icon name='dialog-info'/>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed className='collection-edit-loadorder-edit-info'>
          {t('You can make changes to this data from the ')}
          <a
            className='fake-link'
            onClick={this.openLoadOrderPage}
            title={t('Go to Load Order Page')}
          >
            {t('Load Order page.')}
          </a>
          {t(' If you believe a load order entry is missing, please ensure the '
          + 'relevant mod is enabled and has been added to the collection.')}
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private openLoadOrderPage = () => {
    this.props.api.events.emit('show-main-page', 'file-based-loadorder');
  }
  private renderOpenLOButton = () => {
    const { t } = this.props;
    return (<Button
      id='btn-more-mods'
      className='collection-add-mods-btn'
      onClick={this.openLoadOrderPage}
      bsStyle='ghost'
    >
      {t('Open Load Order Page')}
    </Button>);
  }

  private renderPlaceholder = () => {
    const { t } = this.props;
    return (
      <EmptyPlaceholder
        icon='sort-none'
        text={t('You have no load order entries (for the current mods in the collection)')}
        subtext={this.renderOpenLOButton()}
      />
    );
  }

  private renderModEntry = (loEntry: ILoadOrderEntry, idx: number) => {
    const key = loEntry.id + JSON.stringify(loEntry);
    const classes = ['load-order-entry', 'collection-tab'];
    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
      >
        <FlexLayout type='row'>
          <p className='load-order-index'>{idx}</p>
          <p>{loEntry.name}</p>
        </FlexLayout>
      </ListGroupItem>
    );
  }
}

const empty = [];
function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder: ILoadOrderEntry[] = [];
  if (!!profile?.gameId) {
    loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile.id], empty);
  }

  return {
    gameId: profile?.gameId,
    loadOrder,
    mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], {}),
    profile,
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {};
}

export default withTranslation(['common', NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(
    MorrowindCollectionsDataView) as any) as React.ComponentClass<IBaseProps & IExtendedInterfaceProps>;
