import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import * as Select from 'react-select';


export class PluginFlagFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;

    let selectionFilters = [ 'Master', 'Native', 'Dirty', 'Don\'t clean'];

    const currentFilters = selectionFilters.map(current => ({
      label: current,
      value: current,
    }));

    return <Select
      className='select-compact'
      options={currentFilters}
      value={filter || ''}
      onChange={this.changeFilter}
    />;
  }

  private changeFilter = (value: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  }
}

class PluginFlagsFilter implements ITableFilter {
  public component = PluginFlagFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    return (value.includes(filter));
  }
}


export default PluginFlagsFilter;
