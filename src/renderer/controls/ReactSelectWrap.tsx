/**
 * default placeholder in react-select is a hard-coded, non-translatable text "Select...".
 * This wraps controls such that the text gets translated
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import Select, { Creatable, OptionValues, ReactCreatableSelectProps, ReactSelectProps } from 'react-select';

export * from 'react-select';

function SelectWrap<TValue = OptionValues>(props: ReactSelectProps<TValue>) {
  const { t } = useTranslation();

  if (props.placeholder === undefined) {
    props = {
      ...props,
      placeholder: t('Select...'),
    };
  }

  return (
    <Select {...props} />
  );
}

function CreatableWrap<TValue = OptionValues>(props: ReactCreatableSelectProps<TValue>) {
  const { t } = useTranslation();

  if (props.placeholder === undefined) {
    props = {
      ...props,
      placeholder: t('Select...'),
    };
  }

  return (
    <Creatable {...props} />
  );
}

export {
  CreatableWrap as Creatable,
};

export default SelectWrap;
