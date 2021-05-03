import * as _ from 'lodash';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { EmptyPlaceholder, FlexLayout } from '../../../controls/api';
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';

import { ILoadOrderEntry, LoadOrder } from '../types/types';

const NAMESPACE: string = 'generic-load-order-extension';

interface IConnectedProps {
  gameId: string;
  mods: { [modId: string]: types.IMod };
  loadOrder: LoadOrder;
  profile: types.IProfile;
}

type IProps = types.IGameSpecificInterfaceProps & IConnectedProps;

class LoadOrderCollections extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, loadOrder } = this.props;
    return (!!loadOrder && Object.keys(loadOrder).length !== 0)
      ? (
        <div style={{ overflow: 'auto' }}>
          <h4>{t('Load Order')}</h4>
          <p>
          {t('This tab displays the current state of the load order file which this game uses. ' +
             'If you wish to modify the order/entries please do so by opening the Load Order ' +
             'page; any changes made there will be reflected in this collection once the ' +
             'changes are saved to the file. ')
          }
          </p>
          <p>
          {t('Please note: the game you\'ve created this collection for relies on a load order ' +
             'file which the game extension creates when deploying your mods - to ensure that ' +
             'the correct load order is published alongside this collection, please remember to ' +
             'deploy your mods!')}
        </p>
          <ListGroup id='collections-load-order-list'>
            {loadOrder.map(this.renderModEntry)}
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

  private renderModEntry = (loEntry: ILoadOrderEntry) => {
    const { loadOrder } = this.props;
    const idx: number = loadOrder.indexOf(loEntry);
    const key = loEntry.id + JSON.stringify(loEntry);
    const name = util.renderModName(this.props.mods[loEntry.id]);
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
