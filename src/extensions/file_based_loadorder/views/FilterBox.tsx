/* eslint-disable */
import React from 'react';
import { FormInput } from 'vortex-api';
import { useTranslation } from 'react-i18next';

interface IProps {
  currentFilterValue: string;
  setFilter(value: string): void;
}

const FilterBox: React.FC<IProps> = ({ currentFilterValue, setFilter }) => {
  const [t] = useTranslation('common');
  const applyFilter = React.useCallback((value: string) => setFilter(value), [setFilter]);
  return (
    <FormInput
      type='search'
      id='file-based-load-order-filter'
      className='file-based-load-order-filter'
      value={currentFilterValue}
      placeholder={t('Search for a specific load order entry...')}
      onChange={applyFilter}
      debounceTimer={100}
      clearable
    />
  );
}

export default FilterBox;