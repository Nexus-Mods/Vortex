import {IFilterProps, ITableFilter} from '../../../types/ITableAttribute';

import * as React from 'react';
import Select from 'react-select';
import { DownloadState } from '../types/IDownload';

export class DownloadSelectionFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { t, filter } = this.props;

    const selectionFilters = [ 'Failed', 'Finished', 'In Progress'];

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
        placeholder={t('Select...')}
      />
    );
  }

  private changeFilter = (value: { value: string, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, value !== null ? value.value : null);
  }
}

class DownloadProgressFilter implements ITableFilter {
  public component = DownloadSelectionFilterComponent;
  public raw = false;

  public matches(filter: any, value: DownloadState | number): boolean {
    if (typeof(value) === 'number') {
      return (filter === 'In Progress');
    }
    switch (value) {
      case 'init':
      case 'started':
      case 'paused': return filter === 'In Progress';
      case 'redirect':
      case 'failed': return filter === 'Failed';
      case 'finished': return filter === 'Finished';
    }
  }
}

export default DownloadProgressFilter;
