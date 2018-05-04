import { Button } from '../../controls/TooltipControls';
import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';
import { truthy } from '../../util/util';

import * as React from 'react';
import { FormControl, InputGroup } from 'react-bootstrap';

export class DateTimeFilterComponent extends React.Component<IFilterProps, {}> {
  private currentComparison: 'eq' | 'ge' | 'le';
  private currentValue: Date;
  private comparisons;

  constructor(props: IFilterProps) {
    super(props);

    const filt = props.filter || { comparison: 'eq', value: '' };
    this.currentValue = filt.value;
    this.currentComparison = filt.comparison;

    this.comparisons = {
      eq: {
        symbol: '=',
        tooltip: props.t('Equal'),
      },
      ge: {
        symbol: '\u2265',
        tooltip: props.t('Higher or Equal'),
      },
      le: {
        symbol: '\u2264',
        tooltip: props.t('Less or Equal'),
      },
    };
  }

  public render(): JSX.Element {
    const { filter, t } = this.props;

    const filt = filter || { comparison: 'eq', value: '' };

    const currentComparison = this.comparisons[filt.comparison];

    return (
        <InputGroup style={{ width: '100%' }}>
          <InputGroup.Addon className='group-addon-btn'>
            <Button
              id='btn-date-direction'
              className='btn-embed'
              onClick={this.toggleDirection}
              tooltip={currentComparison.tooltip}
            >
              {currentComparison.symbol}
            </Button>
          </InputGroup.Addon>
          <FormControl
            className='form-field-compact'
            type='Date'
            value={filt.value}
            onChange={this.changeFilter}
          />
        </InputGroup>
    );
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    this.currentValue = evt.currentTarget.value;
    onSetFilter(attributeId,
      { comparison: this.currentComparison, value: this.currentValue });
  }

  private toggleDirection = (evt) => {
    const { attributeId, filter, onSetFilter }  = this.props;

    const filt = filter || { comparison: 'eq', value: '' };

    const options = ['eq', 'ge', 'le'];
    this.currentComparison =
      options[(options.indexOf(filt.comparison) + 1) % options.length] as any;

    onSetFilter(attributeId,
      { comparison: this.currentComparison, value: this.currentValue });
  }
}

function roundToDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setMilliseconds(0);
  result.setSeconds(0);
  result.setMinutes(0);
  result.setHours(0);
  return result;
}

class DateTimeFilter implements ITableFilter {
  public component = DateTimeFilterComponent;
  public raw = false;

  public matches(filter: any, input: any): boolean {
    const { comparison, value } = filter;

    if (!truthy(value)) {
      return true;
    }

    if (!truthy(input)) {
      return false;
    }

    return {
      eq: (lhs, rhs) => lhs.getTime() === rhs.getTime(),
      ge: (lhs, rhs) => lhs >= rhs,
      le: (lhs, rhs) => lhs <= rhs,
    }[comparison](roundToDay(input), roundToDay(new Date(value)));
  }

  public isEmpty(filter: any): boolean {
    return !truthy(filter) || !truthy(filter.value);
  }
}

export default DateTimeFilter;
