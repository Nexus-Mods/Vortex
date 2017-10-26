import { IState } from '../../types/IState';
import { IFilterProps, ITableFilter } from '../../types/ITableAttribute';
import bindProps from '../../util/bindProps';
import { connect } from '../../util/ComponentEx';
import { truthy } from '../../util/util';

import * as React from 'react';
import Select from 'react-select';

type IProps = IFilterProps;

type Options = Array<{ value: any, label: string }>;

interface IBoundProps {
  options: Options;
  multi: boolean;
}

const dummy = '__undefined_BJL9vbThZ';

class OptionsFilterComponent extends React.Component<IProps & IBoundProps, {}> {
  public render(): JSX.Element {
    const { filter, multi, options } = this.props;

    // can't use undefined as a value in Select
    const optionsSane = options.map(
      opt => opt.value === undefined ? { label: opt.label, value: dummy } : opt);

    return (
      <Select
        multi={multi}
        className='select-compact'
        options={optionsSane}
        value={filter}
        onChange={multi ? this.changeFilterMulti : this.changeFilter}
      />
    );
  }

  private changeFilterMulti = (filter: Array<{ value: any, label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, filter.map(val => val.value));
  }

  private changeFilter = (filter: { value: any, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, filter.value);
  }
}

class OptionsFilter implements ITableFilter {
  public component: React.ComponentClass<any>;
  public raw = true;

  private mMulti: boolean;

  constructor(options: Array<{ value: any, label: string }>, multi: boolean) {
    this.component = bindProps({ options, multi })(OptionsFilterComponent);
    this.mMulti = multi;
  }

  public matches(filter: any, value: any): boolean {
    const filtUnsane = filter.map(filt => filt === dummy ? undefined : filt);
    return (this.mMulti)
      ? filtUnsane.indexOf(value) !== -1
      : filtUnsane === value;
  }
}

export default OptionsFilter;
