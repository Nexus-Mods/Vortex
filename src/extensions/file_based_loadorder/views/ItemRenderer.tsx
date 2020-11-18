import * as React from 'react';
import { Checkbox, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx } from '../../../util/ComponentEx';

import { ILoadOrderEntry, LoadOrder } from '../types/types';

import { Icon } from '../../../controls/api';
import { IProfile, IState } from '../../../types/api';

import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { setLoadOrderEntry } from '../actions/loadOrder';

interface IConnectedProps {
  modState: any;
  loadOrder: LoadOrder;
  profile: IProfile;
  displayCheckboxes: boolean;
}

interface IActionProps {
  onSetLoadOrderEntry: (profileId: string, entry: ILoadOrderEntry) => void;
}

interface IBaseProps {
  className?: string;
  item: ILoadOrderEntry;
  forwardRef: (ref: any) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ItemRenderer extends ComponentEx<IProps, {}> {
  public render() {
    const item = this.props.item;
    return (this.isLocked(item))
      ? null
      : this.renderDraggable(item);
  }

  public componentDidMount() {
    const { forwardRef } = this.props;
    forwardRef(this);
  }

  public componentWillUnmount() {
    const { forwardRef } = this.props;
    forwardRef(undefined);
  }

  private renderExternalBanner(): JSX.Element {
    const { t } = this.props;
    return (
    <div className='load-order-unmanaged-banner'>
      <span>{t('Not managed by Vortex')}</span>
      <Icon className='external-caution-logo' name='dialog-info'/>
    </div>
    );
  }

  private renderDraggable(item: ILoadOrderEntry): JSX.Element {
    const { displayCheckboxes, loadOrder, className } = this.props;
    const key = !!item.name ? `${item.name}` : `${item.id}`;

    const position = loadOrder.findIndex(entry => entry.id === item.id);

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const checkBox = () => (displayCheckboxes)
      ? (
        <Checkbox
          className='entry-checkbox'
          checked={loadOrder[position].enabled}
          disabled={this.isLocked(item)}
          onChange={this.onStatusChange}
        />
      )
      : null;

    const lock = () => (this.isLocked(item))
      ? (
        <Icon className='locked-entry-logo' name='locked'/>
      ) : null;

    return (
      <ListGroupItem
        key={key}
        className={classes.join(' ')}
      >
        <p className='load-order-index'>{position}</p>
        {this.isExternal(item) && this.renderExternalBanner()}
        <p>{key}</p>
        {checkBox()}
        {lock()}
      </ListGroupItem>
    );
  }

  private isLocked(item: ILoadOrderEntry): boolean {
    return ['true', 'always'].includes(item.locked);
  }

  private isExternal(item: ILoadOrderEntry): boolean {
    return (item.modId !== undefined) ? false : true;
  }

  private onStatusChange = (evt: any) => {
    const { item, onSetLoadOrderEntry, profile } = this.props;
    const entry = {
      ...item,
      enabled: evt.target.checked,
    };

    onSetLoadOrderEntry(profile.id, entry);
  }
}

const empty = {};
function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const profile: IProfile = selectors.activeProfile(state);
  return {
    profile,
    displayCheckboxes: getSafe(state,
      ['settings', 'loadOrder', 'rendererOptions', profile?.gameId, 'displayCheckboxes'], false),
    loadOrder: getSafe(state, ['persistent', 'loadOrder', profile.id], []),
    modState: getSafe(profile, ['modState'], empty),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetLoadOrderEntry: (profileId, entry) =>
      dispatch(setLoadOrderEntry(profileId, entry)),
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    ItemRenderer) as any) as React.ComponentClass<{
      className?: string,
      item: ILoadOrderEntry,
    }>;
