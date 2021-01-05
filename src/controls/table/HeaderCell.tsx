import { IAttributeState } from '../../types/IAttributeState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { SortDirection } from '../../types/SortDirection';
import getAttr from '../../util/getAttr';
import { preT, TFunction } from '../../util/i18n';

import { IconButton } from '../TooltipControls';

import { TH } from './MyTable';
import SortIndicator from './SortIndicator';

import * as _ from 'lodash';
import * as React from 'react';

export interface IHeaderProps {
  className: string;
  attribute: ITableAttribute;
  state: IAttributeState;
  doFilter: boolean;
  doGroup: boolean;
  onSetSortDirection: (id: string, dir: SortDirection) => void;
  onSetGroup: (id: string) => void;
  onSetFilter: (id?: string, filter?: any) => void;
  t: TFunction;
}

function nextDirection(direction: SortDirection): SortDirection {
  switch (direction) {
    case 'asc': return 'desc';
    default: return 'asc';
  }
}

class HeaderCell extends React.Component<IHeaderProps, {}> {
  private mMinWidth: number = -1;
  private mRef: HTMLDivElement = null;

  public shouldComponentUpdate(newProps: IHeaderProps) {
    // TODO: state is a new object every call, needs to be fixed in Table.tsx
    return (this.props.attribute !== newProps.attribute)
             || !_.isEqual(this.props.state, newProps.state)
             || (this.props.doFilter !== newProps.doFilter)
             || (this.props.doGroup !== newProps.doGroup)
             || (this.props.children !== (newProps as any).children);
  }

  public render(): JSX.Element {
    const { t, attribute, className, doFilter } = this.props;
    const style = {};
    if (this.mMinWidth >= 0) {
      style['minWidth'] = this.mMinWidth;
    }

    return (
      <TH
        className={`table-header-cell ${className}`}
        key={attribute.id}
        domRef={this.setRef}
        style={style}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className='flex-fill'
            style={{ display: 'flex', flexDirection: 'row' }}
            onClick={this.cycleDirection}
          >
            <p style={{ margin: 0 }}>{preT(t, attribute.name)}</p>
            <div className='cell-controls'>
              {attribute.isSortable ? this.renderSortIndicator() : <div/>}
              {attribute.isGroupable ? this.renderGroupIndicator() : null}
            </div>
          </div>
          {doFilter ? this.props.children : null}
        </div>
      </TH>
    );
  }

  public updateWidth() {
    if (this.mRef !== null) {
      if (this.mRef.clientWidth > this.mMinWidth) {
        this.mMinWidth = this.mRef.clientWidth;
      }
    }
  }

  private renderGroupIndicator(): JSX.Element {
    const { t, doGroup } = this.props;
    const classes = [
      'btn-embed',
    ];
    classes.push(doGroup ? 'table-group-enabled' : 'table-group-disabled');
    return (
      <IconButton
        icon='layout-list'
        onClick={this.setGroup}
        tooltip={t('Group the table by this attribute')}
        className={classes.join(' ')}
        tabIndex={-1}
      />);
  }

  private renderSortIndicator(): JSX.Element {
    const { state } = this.props;

    const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;

    return (
      <SortIndicator direction={direction} onSetDirection={this.setDirection}/>
    );
  }

  private setRef = (ref: HTMLDivElement) => {
    this.mRef = ref;
  }

  private cycleDirection = (evt: React.MouseEvent<any>) => {
    const { attribute, onSetSortDirection, state } = this.props;
    if (evt.defaultPrevented) {
      return;
    }
    if (attribute.isSortable) {
      const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;
      onSetSortDirection(attribute.id, nextDirection(direction));
    }
  }

  private setGroup = (evt) => {
    const { onSetGroup, attribute } = this.props;
    onSetGroup(attribute.id);
    evt.preventDefault();
  }

  private setDirection = (dir: SortDirection) => {
    const { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
