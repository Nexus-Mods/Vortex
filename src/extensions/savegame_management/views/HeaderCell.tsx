import { SortDirection } from '../../../types/SortDirection';
import getAttr from '../../../util/getAttr';
import SortIndicator from '../../../views/SortIndicator';

import { IAttributeState } from '../types/IAttributeState';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

import * as React from 'react';

export interface IHeaderProps {
  attribute: ISavegameAttribute;
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
        <div>{t(attribute.name)}
         {this.renderSortIndicator(direction, attribute.id)}
        </div>
      </th>
    );
  }

  private renderSortIndicator(direction: SortDirection, attributeId: string) {

      return (
        <SortIndicator direction={direction} onSetDirection={this.setDirection} />
      );

  }

  private setDirection = (dir: SortDirection) => {
    let { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
