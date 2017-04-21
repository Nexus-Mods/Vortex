import {IFilterProps, ITableFilter} from '../../types/ITableAttribute';

import { IconButton } from '../../views/TooltipControls';

import * as React from 'react';
import { FormControl, InputGroup } from 'react-bootstrap';

let comparisonHigherThan: boolean = true;

export class NumericFilterComponent extends React.Component<IFilterProps, {}> {
  private lastAttributeId;
  private lastValue;

  public render(): JSX.Element {
    const { filter, t } = this.props;
    let directionIcon;
    let tooltip = t('Toggle higher/lower than');

    if (comparisonHigherThan) {
      directionIcon = 'long-arrow-down';
    } else {
      directionIcon = 'long-arrow-up';
    }

    return (
      <InputGroup>
        <FormControl
          className='form-field-compact'
          type='number'
          value={filter || ''}
          onChange={this.changeFilter}
        />
        <InputGroup.Button>
          <IconButton
            className='btn-embed'
            id='toggleDate'
            tooltip={tooltip}
            icon={directionIcon}
            onClick={this.toggleDirection}
          />
        </InputGroup.Button>
      </InputGroup>
    );
  }

  private changeFilter = (evt) => {
    const { attributeId, onSetFilter } = this.props;
    this.lastAttributeId = attributeId;
    this.lastValue = evt.currentTarget.value;
    onSetFilter(attributeId, evt.currentTarget.value);
  }

  private toggleDirection = (evt) => {
    if (this.lastValue === undefined) {
      return;
    }
    comparisonHigherThan = !comparisonHigherThan;
    const { onSetFilter } = this.props;
    onSetFilter(this.lastAttributeId, this.lastValue);
  }
}

class NumericFilter implements ITableFilter {
  public component = NumericFilterComponent;
  public raw = false;

  public matches(filter: any, value: any): boolean {
      return (comparisonHigherThan) ? (value >= filter) : (value <= filter);
  }
}

export default NumericFilter;
