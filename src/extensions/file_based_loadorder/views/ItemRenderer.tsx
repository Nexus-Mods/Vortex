import * as React from 'react';
import { Checkbox, ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx } from '../../../util/ComponentEx';

import { IItemRendererProps, ILoadOrderEntry, LoadOrder } from '../types/types';

import { Icon, tooltip } from '../../../controls/api';
import { IProfile, IState } from '../../../types/api';

import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { setFBLoadOrderEntry } from '../actions/loadOrder';

interface IConnectedProps {
  modState: any;
  loadOrder: LoadOrder;
  profile: IProfile;
}

interface IActionProps {
  onSetLoadOrderEntry: (profileId: string, entry: ILoadOrderEntry) => void;
}

interface IBaseProps {
  className?: string;
  item: IItemRendererProps;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ItemRenderer extends ComponentEx<IProps, {}> {
  public render() {
    const item = this.props.item.loEntry;
    const displayCheckboxes = this.props.item.displayCheckboxes;
    return this.renderDraggable(item, displayCheckboxes);
  }

  private renderValidationError(): JSX.Element {
    const { invalidEntries, loEntry } = this.props.item;
    const invalidEntry = (invalidEntries !== undefined)
      ? invalidEntries.find(inv => inv.id.toLowerCase() === loEntry.id.toLowerCase())
      : undefined;
    return (invalidEntry !== undefined)
      ? (
        <tooltip.Icon
          className='fblo-invalid-entry'
          name='feedback-error'
          tooltip={invalidEntry.reason}
        />
      ) : null;
  }

  private renderExternalBanner(item: ILoadOrderEntry): JSX.Element {
    const { t } = this.props;
    return this.isExternal(item) ? (
      <div className='load-order-unmanaged-banner'>
        <Icon className='external-caution-logo' name='feedback-warning'/>
        <span className='external-text-area'>{t('Not managed by Vortex')}</span>
      </div>
    ) : null;
  }

  private renderDraggable(item: ILoadOrderEntry, displayCheckboxes: boolean): JSX.Element {
    const { loadOrder, className } = this.props;
    const key = !!item.name ? `${item.name}` : `${item.id}`;

    const position = loadOrder.findIndex(entry => entry.id === item.id) + 1;

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    if (this.isExternal(item)) {
      classes = classes.concat('external');
    }

    const checkBox = () => (displayCheckboxes)
      ? (
        <Checkbox
          className='entry-checkbox'
          checked={item.enabled}
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
        ref={this.props.item.setRef}
      >
        <Icon className='drag-handle-icon' name='drag-handle'/>
        <p className='load-order-index'>{position}</p>
        {this.renderValidationError()}

          <p className='load-order-name'>{key}</p>
   
        {this.renderExternalBanner(item)}
        {checkBox()}
        {lock()}
      </ListGroupItem>
    );
  }

  private isLocked(item: ILoadOrderEntry): boolean {
    return [true, 'true', 'always'].includes(item.locked);
  }

  private isExternal(item: ILoadOrderEntry): boolean {
    return (item.modId !== undefined) ? false : true;
  }

  private onStatusChange = (evt: any) => {
    const { item, onSetLoadOrderEntry, profile } = this.props;
    const entry = {
      ...item.loEntry,
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
    loadOrder: getSafe(state, ['persistent', 'loadOrder', profile.id], []),
    modState: getSafe(profile, ['modState'], empty),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetLoadOrderEntry: (profileId, entry) =>
      dispatch(setFBLoadOrderEntry(profileId, entry)),
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    ItemRenderer) as any) as React.ComponentClass<{
      className?: string,
      item: IItemRendererProps,
    }>;
