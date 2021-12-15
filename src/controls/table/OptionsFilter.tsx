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

function OptionsFilterComponent(props: IProps & IBoundProps) {
  const { t, attributeId, filter, multi, onSetFilter } = props;

  const [options, setOptions] = React.useState([]);

  React.useEffect(() => {
    if (Array.isArray(props.options)) {
      setOptions(props.options);
    }
  }, [props.options]);

  const changeFilterMulti = React.useCallback((newFilter: Array<{ value: any, label: string }>) => {
    onSetFilter(attributeId, newFilter.map(val => val.value));
  }, [attributeId, onSetFilter]);

  const changeFilter = React.useCallback((newFilter: { value: any, label: string }) => {
    onSetFilter(attributeId,
      ((newFilter !== undefined) && (newFilter !== null)) ? newFilter.value : undefined);
  }, [attributeId, onSetFilter]);

  const updateOptions = React.useCallback(() => {
    if (!Array.isArray(props.options)) {
      setOptions(props.options());
    }
  }, [props.options]);

  React.useEffect(() => {
    if ((filter !== undefined) && (!Array.isArray(props.options))) {
      // if a filter is already set we do need to know the options
      updateOptions();
    }
  }, []);

  // can't use undefined as a value in Select
  const optionsSane = options.map(
    opt => opt.value === undefined ? { label: opt.label, value: dummy } : opt);

  return (
    <Select
      multi={multi}
      className='select-compact'
      options={optionsSane}
      value={filter}
      onChange={multi ? changeFilterMulti : changeFilter}
      autosize={false}
      placeholder={t('Select...')}
      onOpen={updateOptions}
    />
  );
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
