import { IFilterProps, ITableFilter } from '../../types/ITableAttribute';
import bindProps from '../../util/bindProps';
import { truthy } from '../../util/util';

import * as React from 'react';
import Select from 'react-select';

type IProps = IFilterProps;

export interface ISelectOption {
  value: any;
  label: string;
}

type Options = ISelectOption[];

interface IBoundProps {
  options: Options | (() => Options);
  multi: boolean;
}

const dummy = '__undefined_BJL9vbThZ';

class OptionsFilterComponent extends React.Component<IProps & IBoundProps, {}> {
  public render(): JSX.Element {
    const { t, filter, multi } = this.props;

    let options = this.props.options;
    if (!Array.isArray(options)) {
      options = options();
    }

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
        autosize={false}
        placeholder={t('Select...')}
      />
    );
  }

  private changeFilterMulti = (filter: Array<{ value: any, label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, filter.map(val => val.value));
  }

  private changeFilter = (filter: { value: any, label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId,
      ((filter !== undefined) && (filter !== null)) ? filter.value : undefined);
  }
}

class OptionsFilter implements ITableFilter {
  public static EMPTY = '__empty';
  public component: React.ComponentClass<any>;
  public raw = true;

  private mMulti: boolean;

  constructor(options: Options | (() => Options), multi: boolean, raw?: boolean) {
    this.component = bindProps({ options, multi })(OptionsFilterComponent);
    this.mMulti = multi;
    this.raw = raw !== false;
  }

  public matches(filter: any, value: any): boolean {
    if (this.mMulti && (filter !== undefined) && (filter.length === 0)) {
      return true;
    }

    const filtUnsane = this.mMulti
      ? new Set((filter || []).map(filt => filt === dummy ? undefined : filt))
      : filter;

    if (Array.isArray(value)) {
      if (this.mMulti) {
        if (filtUnsane.has(OptionsFilter.EMPTY) && (value.length === 0)) {
          return true;
        }
      } else if (filter === OptionsFilter.EMPTY) {
        return (value.length === 0);
      }

      const filt = this.mMulti
        ? (iter: any) => filtUnsane.has(iter)
        : (iter: any) => filtUnsane === iter;
      return (value.find(filt) !== undefined);
    } else {
      if (this.mMulti) {
        if (filtUnsane.has(OptionsFilter.EMPTY) && !truthy(value)) {
          return true;
        }
      } else if (filter === OptionsFilter.EMPTY) {
        return !truthy(value);
      }

      return this.mMulti
        ? filtUnsane.has(value)
        : filtUnsane === value;
    }
  }

  public isEmpty(filter: any): boolean {
    return filter.length === 0;
  }
}

export default OptionsFilter;
