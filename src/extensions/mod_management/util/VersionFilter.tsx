import { IFilterProps, ITableFilter } from '../../../types/ITableAttribute';

import updateState from './modUpdateState';

import * as React from 'react';
import Select from 'react-select';

export class VersionFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { t, filter } = this.props;

    const options = [
      { value: 'has-update', label: t('Update available') },
    ];
    return (
      <Select
        className='select-compact'
        options={options}
        value={filter}
        onChange={this.changeFilter}
        autosize={false}
        placeholder={t('Select...')}
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
        const state = updateState(value);
        return state !== 'current';
      } else {
        return true;
      }
    } else {
      return undefined;
    }
  }
}

export default VersionFilter;
