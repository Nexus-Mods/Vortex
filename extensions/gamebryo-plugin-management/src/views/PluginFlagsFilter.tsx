import { types } from 'vortex-api';

import * as React from 'react';
import Select from 'react-select';
import { NAMESPACE } from '../statics';

export class PluginFlagFilterComponent extends React.Component<types.IFilterProps, {}> {
  public render(): JSX.Element {
    const { t, filter } = this.props;

    const selectionFilters = [
      'Master', 'Light', 'Loads Archive', 'Could be light', 'Native', 'Not light', 'Dirty',
      'Don\'t clean', 'Warnings', 'Incompatible', 'LOOT Messages', 'Tags'];

    const currentFilters = selectionFilters.map(current => ({
      label: t(current, { ns: NAMESPACE }),
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
