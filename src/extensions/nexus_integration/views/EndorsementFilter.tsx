import {IFilterProps, ITableFilter} from '../../../types/ITableAttribute';

import * as React from 'react';
import Select from 'react-select';

export class EndorsementFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { t, filter } = this.props;

    const selectionFilters = [ 'Endorsed', 'Abstained', 'Undecided', 'N/A'];

    const currentFilters = selectionFilters.map(current => ({
      label: t(current),
      value: current,
    }));

    return (
      <Select
        className='select-compact'
        options={currentFilters}
        value={filter || ''}
        onChange={this.changeFilter}
        autosize={false}
        placeholder={t('Select...')}
      />
    );
  }

  private changeFilter = (value: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  }
}

class EndorsementFilter implements ITableFilter {
  public component = EndorsementFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    if (value === '') {
      return (filter === 'Undecided');
    } else if (value === undefined) {
      return (filter === 'N/A');
    } else {
      return (filter === value);
    }
  }
}

export default EndorsementFilter;
