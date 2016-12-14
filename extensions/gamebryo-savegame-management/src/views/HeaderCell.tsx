import {SortIndicator, types, util} from 'nmm-api';

import { IAttributeState } from '../types/IAttributeState';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

import * as React from 'react';

export interface IHeaderProps {
  attribute: ISavegameAttribute;
  state: IAttributeState;
  onSetSortDirection: (id: string, dir: types.SortDirection) => void;
  t: Function;
}

class HeaderCell extends React.Component<IHeaderProps, {}> {
  public render(): JSX.Element {
    const { attribute, state, t } = this.props;

    const direction: types.SortDirection =
      util.getSafe(state, ['sortDirection'], 'none') as types.SortDirection;

    return (
      <th key={attribute.id}>
        <div>{t(attribute.name)}
         {this.renderSortIndicator(direction, attribute.id)}
        </div>
      </th>
    );
  }

  private renderSortIndicator(direction: types.SortDirection, attributeId: string) {

      return (
        <SortIndicator direction={direction} onSetDirection={this.setDirection} />
      );

  }

  private setDirection = (dir: types.SortDirection) => {
    let { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
