import { SortDirection } from '../types/SortDirection';
import getAttr from '../util/getAttr';

import { IAttributeState } from '../types/IAttributeState';
import { ITableAttribute } from '../types/ITableAttribute';

import SortIndicator from './SortIndicator';

import * as React from 'react';

export interface IHeaderProps {
  attribute: ITableAttribute;
  state: IAttributeState;
  onSetSortDirection: (id: string, dir: SortDirection) => void;
  t: Function;
}

class HeaderCell extends React.Component<IHeaderProps, {}> {
  public render(): JSX.Element {
    const { attribute, t } = this.props;
    return (
      <th key={attribute.id}>
        <div>{ t(attribute.name) }
        { attribute.isSortable ? this.renderIndicator() : null }
        </div>
      </th>
    );
  }

  private renderIndicator() {
    const { state } = this.props;

    const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;

    return (
      <SortIndicator direction={ direction } onSetDirection={ this.setDirection }/>
    );
  }

  private setDirection = (dir: SortDirection) => {
    let { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
