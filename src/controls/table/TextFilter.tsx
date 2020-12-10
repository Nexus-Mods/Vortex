import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';

export class TextFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    let { filter } = this.props;
    if (typeof(filter) !== 'string') {
      filter = undefined;
    }
    return (
      <FormControl
        className='form-field-compact'
        type='text'
        value={filter || ''}
        onChange={this.changeFilter}
        inputRef={this.props.domRef}
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

  private mCaseInsensitive: boolean;

  constructor(ignoreCase: boolean) {
    this.mCaseInsensitive = ignoreCase;
  }

  public matches(filter: any, value: any): boolean {
    if (typeof(filter) !== 'string') {
      // filter of the wrong type doesn't filter at all
      return true;
    }
    if (typeof(value) !== 'string') {
      return false;
    }
    if (this.mCaseInsensitive) {
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
