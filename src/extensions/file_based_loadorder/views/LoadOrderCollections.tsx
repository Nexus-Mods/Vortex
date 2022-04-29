import * as _ from 'lodash';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { EmptyPlaceholder, FlexLayout, Icon } from '../../../controls/api';
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';

import { IGameSpecificInterfaceProps } from '../types/collections';
import { ILoadOrderEntry, LoadOrder } from '../types/types';

import { genCollectionLoadOrder, isModInCollection, isValidMod } from '../util';

import { findGameEntry } from '../gameSupport';

const NAMESPACE: string = 'generic-load-order-extension';

interface IBaseState {
  loadOrder: LoadOrder;
  filteredModIds: string[];
}

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: LoadOrder;
  profile: types.IProfile;
}

type IProps = IGameSpecificInterfaceProps & IConnectedProps;

class LoadOrderCollections extends ComponentEx<IProps, IBaseState> {
  public static getDerivedStateFromProps(newProps: IProps, prevState: IBaseState) {
    const { mods, collection } = newProps;
    const filtered = newProps.loadOrder.filter(entry => (collection !== undefined)
      ? isValidMod(mods[entry.modId]) && (isModInCollection(collection, mods[entry.modId]))
      : isValidMod(mods[entry.modId]))
    .map(entry => entry.modId);
    if (filtered !== prevState.filteredModIds) {
      return { filteredModIds: filtered };
    }

    return null;
  }
  constructor(props: IProps) {
    super(props);
    this.initState({
      loadOrder: [],
      filteredModIds: [],
    });
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { loadOrder } = this.state;
    return (!!loadOrder && Object.keys(loadOrder).length !== 0)
      ? (
        <div style={{ overflow: 'auto' }}>
          <h4>{t('Load Order')}</h4>
          <p>
          {t('This is a snapshot of the load order information that '
           + 'will be exported with this collection.')}
          </p>
          {this.renderLoadOrderEditInfo()}
          <ListGroup id='collections-load-order-list'>
            {loadOrder.map(this.renderModEntry)}
          </ListGroup>
        </div>
    ) : this.renderPlaceholder();
  }

  public componentDidMount() {
    this.genLoadOrder();
  }

  public componentDidUpdate(prevProps: IProps) {
    const currentRules = JSON.stringify(this.props.collection.rules);
    const prevRules = JSON.stringify(prevProps.collection.rules);
    const currentLO = JSON.stringify(this.props.loadOrder);
    const prevLO = JSON.stringify(prevProps.loadOrder);
    if (currentRules !== prevRules || currentLO !== prevLO) {
      this.genLoadOrder();
    }
  }

  private async genLoadOrder() {
    const gameEntry = findGameEntry(this.props.gameId);
    this.nextState.loadOrder = await genCollectionLoadOrder(this.context.api,
      gameEntry, this.props.mods, this.props.profile.id, this.props.collection);
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
          {t(' Note that the game you\'ve created this collection for relies on a load order ' +
            'file which the game extension creates when deploying your mods - to ensure that ' +
            'the correct load order is published alongside this collection, please remember to ' +
            'deploy your mods!')}
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

  private renderModEntry = (loEntry: ILoadOrderEntry) => {
    const { loadOrder } = this.state;
    const idx: number = loadOrder.indexOf(loEntry);
    const key = loEntry.id + JSON.stringify(loEntry);
    const name = loEntry.name || (loEntry.modId !== undefined)
      ? util.renderModName(this.props.mods[loEntry.modId])
      : loEntry.id;
    const classes = ['load-order-entry', 'collection-tab'];
    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
      >
        <FlexLayout type='row'>
          <p className='load-order-index'>{idx}</p>
          <p>{name}</p>
        </FlexLayout>
      </ListGroupItem>
    );
  }
}

function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder: LoadOrder = [];
  if (!!profile?.gameId) {
    loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile.id], []);
  }

  return {
    gameId: profile?.gameId,
    loadOrder,
    mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], {}),
    profile,
  };
}

export default withTranslation(['common', NAMESPACE])(
  connect(mapStateToProps, undefined)(
    LoadOrderCollections) as any) as React.ComponentClass<{}>;
