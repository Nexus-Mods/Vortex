import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';

export class TextFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;
    return (
      <FormControl
        className='form-field-compact'
        type='text'
        value={filter || ''}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, evt.currentTarget.value);
  }
}

class TextFilter implements ITableFilter {
  public component = TextFilterComponent;
  public raw = false;

  private mCaseSensitive: boolean;

  constructor(caseSensitive: boolean) {
    this.mCaseSensitive = caseSensitive;
  }

  public matches(filter: any, value: any): boolean {
    if (this.mCaseSensitive) {
      if ((value === undefined) || (filter === undefined)) {
        return false;
      }
      return value.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    } else {
      return value.indexOf(filter) !== -1;
    }
  }
}

export default TextFilter;
