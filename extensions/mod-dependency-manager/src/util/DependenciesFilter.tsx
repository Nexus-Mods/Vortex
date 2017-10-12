import * as React from 'react';
import * as SelectX from 'react-select';
import { types } from 'vortex-api';

// TODO: having problem with types
const Select: any = SelectX;

export class DependenciesFilterComponent extends React.Component<types.IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;

    const options = [
      { value: 'has-conflict', label: 'Has file conflict' },
      { value: 'has-unsolved', label: 'Has unsolved file conflict' },
    ];
    return (
      <Select
        className='select-compact'
        options={options}
        value={filter}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (filter: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, filter !== undefined ? filter.value : undefined);
  }
}

class DependenciesFilter implements types.ITableFilter {
  public component = DependenciesFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
    // TODO: not trivial to implement, because the value doesn't contain
    //   any information about file conflicts
    return true;
  }
}

export default DependenciesFilter;
