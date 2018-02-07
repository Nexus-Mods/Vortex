import { IPluginCombined } from '../types/IPlugins';

import { tooltip } from 'vortex-api';

import * as I18next from 'i18next';
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

  if ((plugin.dirtyness !== undefined) && (plugin.dirtyness.length > 0)) {
    result.push(t('Dirty'));
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
        name='plugin-master'
        tooltip={t('Master')}
      />);
  }

  if (plugin.parseFailed) {
    const key = `ico-parsefailed-${plugin.name}`;
    flags.push(
      <tooltip.Icon
        id={key}
        key={key}
        name='parse-failed'
        tooltip={t('Failed to parse this plugin', { ns: 'gamebryo-plugin' })}
      />);
  }

  if (plugin.isNative) {
    const key = `ico-native-${plugin.name}`;
    flags.push(
      <tooltip.Icon
        id={key}
        key={key}
        name='plugin-native'
        tooltip={t('Loaded by the engine, can\'t be configured', { ns: 'gamebryo-plugin' })}
      />);
  }

  const cleanKey = `ico-clean-${plugin.name}`;
  if ((plugin.dirtyness !== undefined) && (plugin.dirtyness.length > 0)) {
    flags.push(
      <tooltip.Icon
        id={cleanKey}
        key={cleanKey}
        name='plugin-clean'
        tooltip={t('Requires cleaning (LOOT)', { ns: 'gamebryo-plugin' })}
      />);
  }/* else if (plugin.cleanliness === 'do_not_clean') {
    flags.push(
      <tooltip.Icon
        id={cleanKey}
        key={cleanKey}
        name='plugin-dont-clean'
        tooltip={t('Must not be cleaned (LOOT)', { ns: 'gamebryo-plugin' })}
      />);
  }*/

  return (
    <div>
      {flags}
    </div>
  );
};

export default PluginFlags;
