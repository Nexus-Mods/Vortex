import { IAttributeState } from '../../types/IAttributeState';
import { ITableAttribute } from '../../types/ITableAttribute';
import { SortDirection } from '../../types/SortDirection';
import getAttr from '../../util/getAttr';

import { TH } from './MyTable';
import SortIndicator from './SortIndicator';

import * as I18next from 'i18next';
import * as React from 'react';

export interface IHeaderProps {
  className: string;
  attribute: ITableAttribute;
  state: IAttributeState;
  doFilter: boolean;
  advancedMode: boolean;
  onSetSortDirection: (id: string, dir: SortDirection) => void;
  onSetFilter: (id?: string, filter?: any) => void;
  t: I18next.TranslationFunction;
}

function nextDirection(direction: SortDirection): SortDirection {
  switch (direction) {
    case 'asc': return 'desc';
    default: return 'asc';
  }
}

class HeaderCell extends React.Component<IHeaderProps, {}> {
  public shouldComponentUpdate(newProps: IHeaderProps) {
    // TODO: state is a new object every call, needs to be fixed in Table.tsx
    return (this.props.attribute !== newProps.attribute)
             || !_.isEqual(this.props.state, newProps.state)
             || (this.props.doFilter !== newProps.doFilter)
             || (this.props.advancedMode !== newProps.advancedMode)
             || (this.props.children !== (newProps as any).children);
  }

  public render(): JSX.Element {
    const { t, attribute, className, doFilter } = this.props;
    return (
      <TH
        className={`table-header-cell ${className}`}
        key={attribute.id}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className='flex-fill'
            style={{ display: 'flex', flexDirection: 'row' }}
            onClick={this.cycleDirection}
          >
            <p style={{ margin: 0 }}>{t(attribute.name)}</p>
            <div style={{ whiteSpace: 'nowrap' }}>
            {attribute.isSortable ? this.renderSortIndicator() : null}
            </div>
          </div>
          {doFilter ? this.props.children : null}
        </div>
      </TH>
    );
  }

  private renderSortIndicator(): JSX.Element {
    const { state } = this.props;

    const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;

    return (
      <SortIndicator direction={direction} onSetDirection={this.setDirection}/>
    );
  }

  private cycleDirection = () => {
    const { attribute, onSetSortDirection, state } = this.props;
    if (attribute.isSortable) {
      const direction: SortDirection = getAttr(state, 'sortDirection', 'none') as SortDirection;
      onSetSortDirection(attribute.id, nextDirection(direction));
    }
  }

  private setDirection = (dir: SortDirection) => {
    const { attribute, onSetSortDirection } = this.props;
    onSetSortDirection(attribute.id, dir);
  }
}

export default HeaderCell;
