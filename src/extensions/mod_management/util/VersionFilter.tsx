import { IFilterProps, ITableFilter } from '../../../types/ITableAttribute';

import versionClean from './versionClean';

import * as React from 'react';
import Select from 'react-select';

export class VersionFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;

    const options = [
      { value: 'has-update', label: 'Update available' },
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
    if (filter !== null) {
      onSetFilter(attributeId, filter.value);
    } else {
      onSetFilter(attributeId, undefined);
    }
  }
}

class VersionFilter implements ITableFilter {
  public component = VersionFilterComponent;
  public raw = true;
  public dataId = 'attributes';

  public matches(filter: any, value: any): boolean {
    if (value !== undefined) {
      if (filter === 'has-update') {
        return (value.newestVersion !== undefined)
          && (versionClean(value.newestVersion) !== versionClean(value.version));
      } else {
        return true;
      }
    } else {
      return undefined;
    }
  }
}

export default VersionFilter;
