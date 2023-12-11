import * as React from 'react';
import { Checkbox, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as url from 'url';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import { IItemRendererOptions, ILoadOrder, ILoadOrderDisplayItem,
  ILoadOrderEntry } from '../types/types';

import { Icon } from '../../../controls/api';
import { IProfile, IState } from '../../../types/api';

import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { setLoadOrderEntry } from '../actions/loadOrder';

interface IConnectedProps {
  modState: any;
  loadOrder: ILoadOrder;
  profile: IProfile;
  itemRendererOptions: IItemRendererOptions;
}

interface IActionProps {
  onSetLoadOrderEntry: (profileId: string, modId: string, entry: ILoadOrderEntry) => void;
}

interface IBaseProps {
  className?: string;
  item: ILoadOrderDisplayItem;
  onRef: (element: any) => any;
  onContextMenu?: (evt: any) => any;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class DefaultItemRenderer extends ComponentEx<IProps, {}> {
  constructor(props: IProps) {
    super(props);
    this.initState({});
  }

  public render() {
    const item = this.props.item;
    return (!!item.locked)
      ? this.renderLocked(item)
      : this.renderDraggable(item);
  }

  private renderModImg(): JSX.Element {
    const { itemRendererOptions, item } = this.props;
    let effectiveURL;
    try {
      effectiveURL = url.parse(item.imgUrl);
    } catch (err) {
      return null;
    }
    effectiveURL = (effectiveURL.protocol !== null)
      ? item.imgUrl
      : url.pathToFileURL(item.imgUrl).href;
    return (itemRendererOptions.listViewType !== 'compact')
      ? <img src={effectiveURL} id='mod-img'/>
      : null;
  }

  private renderExternalBanner(): JSX.Element {
    const { t } = this.props;
    return (
    <div className='load-order-unmanaged-banner'>
      <span>{t('Not managed by Vortex')}</span>
      <Icon className='external-caution-logo' name='feedback-warning'/>
    </div>
    );
  }

  private renderLocked(item: ILoadOrderDisplayItem): JSX.Element {
    const { loadOrder, className } = this.props;
    const position = (item.prefix !== undefined)
      ? item.prefix
      : loadOrder[item.id].pos + 1;

    const key = `${item.name}-${position}`;

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }
    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
        onContextMenu={this.props.onContextMenu}
      >
        <p className='load-order-index'>{position}</p>
        {this.renderModImg()}
        <div>
          <p>{item.name}</p>
          {(item.external === true) && this.renderExternalBanner()}
        </div>
        <Icon className='locked-entry-logo' name='locked'/>
      </ListGroupItem>
    );
  }

  private renderDraggable(item: ILoadOrderDisplayItem): JSX.Element {
    const { loadOrder, className, itemRendererOptions } = this.props;
    const position = (item.prefix !== undefined)
      ? item.prefix
      : loadOrder[item.id].pos + 1;

    const key = `${item.name}-${position}`;

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const checkBox = () => (!!itemRendererOptions?.displayCheckboxes)
      ? (
        <Checkbox
          className='entry-checkbox'
          checked={loadOrder[item.id].enabled}
          disabled={item.locked}
          onChange={this.onStatusChange}
        />
      )
      : null;

    return (
      <ListGroupItem
        ref={this.setRef}
        key={key}
        className={classes.join(' ')}
        onContextMenu={this.props.onContextMenu}
      >
        <Icon className='drag-handle-icon' name='drag-handle'/>
        <p className='load-order-index'>{position}</p>
        <div>
          {(!!item?.external) && this.renderExternalBanner()}
          {this.renderModImg()}
        </div>
        <p>{item.name}</p>
        {checkBox()}
      </ListGroupItem>
    );
  }

  private onStatusChange = (evt: any) => {
    const { loadOrder, item, onSetLoadOrderEntry, profile } = this.props;
    const entry = {
      pos: loadOrder[item.id].pos,
      enabled: evt.target.checked,
    };

    onSetLoadOrderEntry(profile.id, item.id, entry);
  }

  private setRef = (ref: any): any => {
    return this.props.onRef(ref);
  }
}

const empty = {};
const defaultRendererOpts: IItemRendererOptions = { listViewType: 'full', displayCheckboxes: true };
function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const profile: IProfile = selectors.activeProfile(state);
  return {
    profile,
    loadOrder: getSafe(state, ['persistent', 'loadOrder', profile.id], empty),
    modState: getSafe(profile, ['modState'], empty),
    itemRendererOptions: getSafe(state,
      ['settings', 'loadOrder', 'rendererOptions', profile.gameId], defaultRendererOpts),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetLoadOrderEntry: (profileId, modId, entry) =>
      dispatch(setLoadOrderEntry(profileId, modId, entry)),
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    DefaultItemRenderer) as any) as React.ComponentClass<{
      className?: string,
      item: ILoadOrderDisplayItem,
      onRef: (ref: any) => any
      onContextMenu?: (evt: any) => any }>;
