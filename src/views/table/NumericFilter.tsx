import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';

export class NumericFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;
    return <FormControl
      className='form-field-compact'
      type='number'
      value={filter || ''}
      onChange={this.changeFilter}
    />;
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, evt.currentTarget.value);
  }
}

class NumericFilter implements ITableFilter {
  public component = NumericFilterComponent;
  public raw = false;

  constructor() { }

  public matches(filter: any, value: any): boolean {
      return (value >= filter);
  }
}

export default NumericFilter;
