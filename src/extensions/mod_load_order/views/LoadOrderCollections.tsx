import * as _ from 'lodash';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { EmptyPlaceholder, FlexLayout, Icon, Usage } from '../../../controls/api';
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';

import { IGameSpecificInterfaceProps } from '../types/collections';
import { ILoadOrder, ILoadOrderEntry } from '../types/types';
import { genCollectionLoadOrder } from '../util';

const NAMESPACE: string = 'generic-load-order-extension';

interface IBaseState {
  sortedMods: ILoadOrder;
}

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: ILoadOrder;
  profile: types.IProfile;
}

interface IActionProps {
}

type IProps = IActionProps & IGameSpecificInterfaceProps & IConnectedProps;
type IComponentState = IBaseState;

class LoadOrderCollections extends ComponentEx<IProps, IComponentState> {
  public static getDerivedStateFromProps(newProps: IProps, state: IComponentState) {
    const { loadOrder, mods, collection } = newProps;
    const sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
    return (sortedMods !== state.sortedMods) ? { sortedMods } : null;
  }

  constructor(props: IProps) {
    super(props);
    const { loadOrder, mods, collection } = props;
    this.initState({
      sortedMods: genCollectionLoadOrder(loadOrder, mods, collection) || {},
    });
  }

  public componentDidMount() {
    const { loadOrder, mods, collection } = this.props;
    this.nextState.sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
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
            {Object.keys(sortedMods).map(this.renderModEntry)}
          </ListGroup>
        </div>
      ) : this.renderPlaceholder();
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
          {t(' Note that some games will require the mods to be enabled or deployed ' +
             'in order for the load order to be generated.')}
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private openLoadOrderPage = () => {
    this.context.api.events.emit('show-main-page', 'generic-loadorder');
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

  private renderModEntry = (modId: string) => {
    const loEntry: ILoadOrderEntry = this.state.sortedMods[modId];
    const key = modId + JSON.stringify(loEntry);
    const name = util.renderModName(this.props.mods[modId]);
    const classes = ['load-order-entry', 'collection-tab'];
    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
      >
        <FlexLayout type='row'>
          <p className='load-order-index'>{loEntry.pos}</p>
          <p>{name}</p>
        </FlexLayout>
      </ListGroupItem>
    );
  }
}

const empty = {};
function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder: ILoadOrder = {};
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
    LoadOrderCollections) as any) as React.ComponentClass<{}>;
