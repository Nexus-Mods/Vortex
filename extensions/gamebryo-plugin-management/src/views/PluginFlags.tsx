import { IPluginCombined } from '../types/IPlugins';

import { tooltip } from 'vortex-api';

import * as React from 'react';

interface IBaseProps {
  plugin: IPluginCombined;
}

type IProps = IBaseProps & {
  t: I18next.TranslationFunction;
};

export function getPluginFlags(plugin: IPluginCombined, t: I18next.TranslationFunction): string[] {
  const result: string[] = [];

  if (plugin.isMaster) {
    result.push(t('Master'));
  }

  if (plugin.parseFailed) {
    result.push(t('Couldn\'t parse'));
  }

  if (plugin.isNative) {
    result.push(t('Native'));
  }

  switch (plugin.cleanliness) {
    case 'dirty':
      {
        result.push(t('Dirty'));
      }
      break;
    case 'do_not_clean':
      {
        result.push(t('Don\'t clean'));
      }
      break;
    default: break;
  }
  return result;
}

const PluginFlags = (props: IProps): JSX.Element => {
  const { plugin, t } = props;

  const flags: JSX.Element[] = [];

  if (plugin.isMaster) {
    const key = `ico-master-${plugin.name}`;
    flags.push(
      <tooltip.Icon
        id={key}
        key={key}
        name='globe'
        tooltip={t('Master')}
      />);
  }

  if (plugin.parseFailed) {
    const key = `ico-parsefailed-${plugin.name}`;
    flags.push(
      <tooltip.Icon
        id={key}
        key={key}
        name='ban-bold'
        tooltip={t('Failed to parse this plugin')}
      />);
  }

  if (plugin.isNative) {
    const key = `ico-native-${plugin.name}`;
    flags.push(
      <tooltip.Icon
        id={key}
        key={key}
        name='lock'
        tooltip={t('Loaded by the engine, can\'t be configured')}
      />);
  }

  const cleanKey = `ico-clean-${plugin.name}`;
  if (plugin.cleanliness === 'dirty') {
    flags.push(
      <tooltip.Icon
        id={cleanKey}
        key={cleanKey}
        name='bug'
        tooltip={t('Requires cleaning (LOOT)')}
      />);
  } else if (plugin.cleanliness === 'do_not_clean') {
    flags.push(
      <tooltip.Icon
        id={cleanKey}
        key={cleanKey}
        name='shield'
        tooltip={t('Must not be cleaned (LOOT)')}
      />);
  }

  return (
    <div>
      {flags}
    </div>
  );
};

export default PluginFlags;
