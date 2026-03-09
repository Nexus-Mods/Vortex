import * as _ from 'lodash';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { ComponentEx, EmptyPlaceholder, FlexLayout, Icon,
  selectors, types, util } from 'vortex-api';

import { IExtendedInterfaceProps, ILoadOrder, ILoadOrderEntry } from '../collections/types';
import { genCollectionLoadOrder } from '../collections/util';
import { IFBLOLoadOrderEntry } from 'vortex-api/lib/types/api';

const NAMESPACE: string = 'generic-load-order-extension';

interface IBaseState {
  sortedMods: types.IFBLOLoadOrderEntry[];
}

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: types.IFBLOLoadOrderEntry[];
  profile: types.IProfile;
}

type IProps = IExtendedInterfaceProps & IConnectedProps;
type IComponentState = IBaseState;

class CollectionsDataView extends ComponentEx<IProps, IComponentState> {
  public static getDerivedStateFromProps(newProps: IProps, state: IComponentState) {
    const { loadOrder, mods, collection } = newProps;
    const sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
    return (sortedMods !== state.sortedMods) ? { sortedMods } : null;
  }

  constructor(props: IProps) {
    super(props);
    const { loadOrder, mods, collection } = props;
    this.initState({
      sortedMods: genCollectionLoadOrder(loadOrder, mods, collection) || [],
    });
  }

  public componentDidMount() {
    const { loadOrder, mods, collection } = this.props;
    this.nextState.sortedMods = genCollectionLoadOrder(loadOrder, mods, collection);
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { sortedMods } = this.state;
    return (!!sortedMods && sortedMods.length !== 0)
      ? (
        <div style={{ overflow: 'auto' }}>
          <h4>{t('Witcher 3 Merged Data')}</h4>
          <p>
          {t('The Witcher 3 game extension executes a series of file merges for UI/menu mods '
           + 'whenever the mods are deployed - these will be included in the collection. '
           + '(separate from the ones done using the script '
           + 'merger utility) To ensure that Vortex includes the correct data when '
           + 'uploading this collection, please make sure that the mods are enabled and '
           + 'deployed before attempting to upload the collection.')}
          </p>
          <p>
          {t('Additionally - please remember that any script merges (if applicable) done '
           + 'through the script merger utility, should be reviewed before uploading, to '
           + 'only include merges that are necessary for the collection to function correctly. '
           + 'Merged scripts referencing a mod that is not included in your collection will most '
           + 'definitively cause the game to crash!')}
          </p>
          <h4>{t('Load Order')}</h4>
          <p>
          {t('This is a snapshot of the load order information that '
           + 'will be exported with this collection.')}
          </p>
          {this.renderLoadOrderEditInfo()}
          <ListGroup id='collections-load-order-list'>
            {sortedMods.map(this.renderModEntry)}
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

  private renderModEntry = (loEntry: IFBLOLoadOrderEntry, index: number) => {
    const key = loEntry.modId + JSON.stringify(loEntry);
    const name = loEntry.modId
      ? `${util.renderModName(this.props.mods[loEntry.modId]) ?? loEntry.id} (${loEntry.name})`
      : loEntry.name ?? loEntry.id;

    const classes = ['load-order-entry', 'collection-tab'];
    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
      >
        <FlexLayout type='row'>
          <p className='load-order-index'>{index + 1}</p>
          <p>{name}</p>
        </FlexLayout>
      </ListGroupItem>
    );
  }
}

function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder: types.LoadOrder = [];
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
  connect(mapStateToProps)(
    CollectionsDataView) as any) as React.ComponentClass<IExtendedInterfaceProps>;
