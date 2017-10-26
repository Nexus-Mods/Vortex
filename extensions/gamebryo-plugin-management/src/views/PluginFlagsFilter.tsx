import { types } from 'vortex-api';

import * as React from 'react';
import Select from 'react-select';

export class PluginFlagFilterComponent extends React.Component<types.IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;

    const selectionFilters = [ 'Master', 'Native', 'Dirty', 'Don\'t clean'];

    const currentFilters = selectionFilters.map(current => ({
      label: current,
      value: current,
    }));

    return (
    <Select
      className='select-compact'
      options={currentFilters}
      value={filter || ''}
      onChange={this.changeFilter}
    />);
  }

  private changeFilter = (value: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  }
}

class PluginFlagsFilter implements types.ITableFilter {
  public component = PluginFlagFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    return (value.includes(filter));
  }
}

export default PluginFlagsFilter;
