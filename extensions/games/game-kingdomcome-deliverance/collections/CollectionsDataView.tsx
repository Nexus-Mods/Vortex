import * as _ from 'lodash';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { genCollectionLoadOrder, getModId } from './util';

import { ComponentEx, EmptyPlaceholder, FlexLayout,
  selectors, types, Usage, util } from 'vortex-api';

const NAMESPACE: string = 'generic-load-order-extension';

interface IExtendedInterfaceProps {
  collection: types.IMod;
}

interface IBaseState {
  sortedMods: string[];
}

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: string[];
  profile: types.IProfile;
}

interface IActionProps {
}

type IProps = IActionProps & IExtendedInterfaceProps & IConnectedProps;
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
    return (!!sortedMods && Object.keys(sortedMods).length !== 0)
      ? (
        <div style={{ overflow: 'auto' }}>
          <h4>{t('Load Order')}</h4>
          <p>
          {t('Below is a preview of the load order for the mods that ' +
             'are included in the current collection. If you wish to modify the load ' +
             'please do so by opening the Load Order page; any changes made there ' +
             'will be reflected in this collection.')
          }
          </p>
          <ListGroup id='collections-load-order-list'>
            {sortedMods.map(this.renderModEntry)}
          </ListGroup>
        </div>
    ) : this.renderPlaceholder();
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

  private renderModEntry = (loId: string) => {
    const { mods } = this.props;
    const { sortedMods } = this.state;
    const loEntry: string = this.state.sortedMods[loId];
    const idx = this.state.sortedMods.indexOf(loId);
    const key = `${idx}-${loId}`;
    const modId = getModId(mods, loId);
    const name = util.renderModName(this.props.mods[modId]) || modId;
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
  let loadOrder: string[] = [];
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

function mapDispatchToProps(dispatch: any): IActionProps {
  return {};
}

export default withTranslation(['common', NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(
    CollectionsDataView) as any) as React.ComponentClass<IExtendedInterfaceProps>;
