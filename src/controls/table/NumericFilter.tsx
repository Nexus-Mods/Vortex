import { Button } from '../../controls/TooltipControls';
import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';
import { truthy } from '../../util/util';

import * as React from 'react';
import { FormControl, InputGroup } from 'react-bootstrap';

export class NumericFilterComponent extends React.Component<IFilterProps, {}> {
  private currentComparison: 'eq' | 'ge' | 'le';
  private currentValue: number;
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
        tooltip: props.t('Greater-than or Equal'),
      },
      le: {
        symbol: '\u2264',
        tooltip: props.t('Less-than or Equal'),
      },
    };
  }

  public render(): JSX.Element {
    const { filter, t } = this.props;

    const filt = filter || { comparison: 'eq', value: '' };

    const currentComparison = this.comparisons[filt.comparison]
                            ?? this.comparisons.eq;

    return (
      <InputGroup style={{ width: '100%' }}>
        <InputGroup.Addon className='group-addon-btn'>
          <Button
            id='btn-numeric-direction'
            className='btn-embed'
            onClick={this.toggleDirection}
            tooltip={currentComparison.tooltip}
          >
            {currentComparison.symbol}
          </Button>
        </InputGroup.Addon>
        <FormControl
          className='form-field-compact'
          type='number'
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

class NumericFilter implements ITableFilter {
  public component = NumericFilterComponent;
  public raw = false;

  public matches(filter: any, input: number): boolean {
    const { comparison, value } = filter;

    if (!truthy(value)) {
      return true;
    }

    return {
      eq: (lhs, rhs) => lhs === rhs,
      ge: (lhs, rhs) => lhs >= rhs,
      le: (lhs, rhs) => lhs <= rhs,
    }[comparison](input, parseInt(value, 10));
  }
}

export default NumericFilter;
