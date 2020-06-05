import * as React from 'react';
import { Checkbox, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import {  ILoadOrder, ILoadOrderDisplayItem, ILoadOrderEntry } from '../types/types';

import { Icon } from '../../../controls/api';
import { IProfile, IState } from '../../../types/api';

import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { setLoadOrderEntry } from '../actions/loadOrder';

interface IConnectedProps {
  modState: any;
  loadOrder: ILoadOrder;
  profile: IProfile;
}

interface IActionProps {
  onSetLoadOrderEntry: (profileId: string, modId: string, entry: ILoadOrderEntry) => void;
}

interface IBaseProps {
  className?: string;
  item: ILoadOrderDisplayItem;
  onRef: (element: any) => any;
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
      <ListGroupItem key={key} className={classes.join(' ')}>
        <p className='load-order-index'>{position}</p>
        <img src={item.imgUrl} id='mod-img'/>
        <p>{item.name}</p>
        <Icon className='locked-entry-logo' name='locked'/>
      </ListGroupItem>
    );
  }

  private renderDraggable(item: ILoadOrderDisplayItem): JSX.Element {
    const { loadOrder, className } = this.props;
    const position = (item.prefix !== undefined)
      ? item.prefix
      : loadOrder[item.id].pos + 1;

    const key = `${item.name}-${position}`;

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const unmanagedBanner = () => (!!item.external)
      ? (
          <div className='load-order-unmanaged-banner'>
            <span>Not managed by Vortex</span>
            <Icon className='external-caution-logo' name='dialog-info'/>
          </div>
        )
      : null;

    return (
      <ListGroupItem ref={this.setRef} key={key} className={classes.join(' ')}>
        <p className='load-order-index'>{position}</p>
        <div>
          {unmanagedBanner()}
          <img src={item.imgUrl} id='mod-img'/>
        </div>
        <p>{item.name}</p>
        <Checkbox
          className='entry-checkbox'
          checked={loadOrder[item.id].enabled}
          disabled={item.locked}
          onChange={this.onStatusChange}
        />
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

function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const profile: IProfile = selectors.activeProfile(state);
  return {
    profile,
    loadOrder: getSafe(state, ['persistent', 'loadOrder', profile.id], {}),
    modState: getSafe(profile, ['modState'], {}),
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
      onRef: (ref: any) => any}>;
