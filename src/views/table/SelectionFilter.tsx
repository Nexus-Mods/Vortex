import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';
import update = require('react-addons-update');


export interface IFilters {
  key: string;
  filter: string;
}

export interface IState {
  selectionFilters: IFilters[];
}

export class SelectionFilterComponent extends React.Component<IFilterProps, IState> {
  constructor(props) {
    super(props);

    this.state = {
      selectionFilters: [],
    };

    let filters = ['Error', 'Finished', 'In Progress'];

    const currentFilters = filters.map((key) => {
      let filterValue = undefined;
      filterValue = key + ' test';
      return { key, filterValue };
    });

    this.setState(update(this.state, {
      selectionFilters: { $set: currentFilters },
    }));
  }

  public render(): JSX.Element {
    const { filter } = this.props;
    return <FormControl
      className='form-field-compact'
      type='select'
      value={filter || ''}
      onChange={this.changeFilter}
    >
    </FormControl>;
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, evt.currentTarget.value);
  }
}

class SelectionFilter implements ITableFilter {
  public component = SelectionFilterComponent;
  public raw = false;

  constructor(filters: string[]) {
  }

  public matches(filter: any, value: any): boolean {
      return value.indexOf(filter) !== -1;
  }
}


export default SelectionFilter;
