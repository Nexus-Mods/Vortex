import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';

export class DateTimeFilterComponent extends React.Component<IFilterProps, {}> {
  public render(): JSX.Element {
    const { filter } = this.props;
    return <FormControl
      className='form-field-compact'
      type='Date'
      value={filter || ''}
      onChange={this.changeFilter}
    />;
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, evt.currentTarget.value);
  }
}

class DateTimeFilter implements ITableFilter {
  public component = DateTimeFilterComponent;
  public raw = false;

  constructor() {
  }

  public matches(filter: any, value: any): boolean {
      return (new Date(value) >= new Date(filter));
  }
}

export default DateTimeFilter;