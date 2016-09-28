import { SortDirection } from '../../../types/SortDirection';
import SortIndicator from '../../../views/SortIndicator';

import { IAttributeState } from '../types/IAttributeState';
import { IModAttribute } from '../types/IModAttribute';

import * as React from 'react';

function getAttr<T>(state: IAttributeState, key: string, def: T): T {
  if (state === undefined) {
    return def;
  }

  return state[key] !== undefined ? state[key] : def;
}

interface IHeaderProps {
  attribute: IModAttribute;
  state: IAttributeState;
  onSetSortDirection: (id: string, dir: SortDirection) => void;
  t: Function;
}

class HeaderCell extends React.Component<IHeaderProps, {}> {
  public render(): JSX.Element {
    const { attribute, state, t } = this.props;

    const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;

    return (
      <th key={attribute.id}>
        <div>{ t(attribute.name) }
        <SortIndicator direction={ direction } onSetDirection={ this.setDirection }/>
        </div>
      </th>
    );
  }

  private setDirection = (dir: SortDirection) => {
    let { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
