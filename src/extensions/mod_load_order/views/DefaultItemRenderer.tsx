import * as React from 'react';
import { ListGroupItem } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx, Icon, selectors, types, util } from 'vortex-api';
import { ILoadOrder, ILoadOrderDisplayItem } from '../types/types';

interface IConnectedProps {
  modState: any;
  loadOrder: ILoadOrder;
}

interface IBaseProps {
  className?: string;
  item: ILoadOrderDisplayItem;
  onRef: (element: any) => any;
}

type IProps = IBaseProps & IConnectedProps;

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
      </ListGroupItem>
    );
  }

  private setRef = (ref: any): any => {
    return this.props.onRef(ref);
  }
}

function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
  const profile: types.IProfile = selectors.activeProfile(state);
  return {
    loadOrder: util.getSafe(state, ['persistent', 'loadOrder', profile.id], {}),
    modState: util.getSafe(profile, ['modState'], {}),
  };
}

export default withTranslation(['common'])(
  connect(mapStateToProps)(
    DefaultItemRenderer) as any) as React.ComponentClass<{
      className?: string,
      item: ILoadOrderDisplayItem,
      onRef: (ref: any) => any}>;
