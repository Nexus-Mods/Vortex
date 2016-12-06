import {IPluginCombined} from '../types/IPlugins';

import {tooltip} from 'nmm-api';
import {translate} from 'react-i18next';

import * as React from 'react';

interface IBaseProps {
  plugin: IPluginCombined;
}

type IProps = IBaseProps & {
  t: I18next.TranslationFunction;
}

const PluginFlags = (props: IProps): JSX.Element => {
  const {plugin, t} = props;

  let flags: JSX.Element[] = [];

  if (plugin.isMaster) {
    let key = `ico-master-${plugin.name}`;
    flags.push(<tooltip.Icon
      id={key}
      key={key}
      name='globe'
      tooltip={t('Master')}
    />);
  }

  if (plugin.isNative) {
    let key = `ico-native-${plugin.name}`;
    flags.push(<tooltip.Icon
      id={key}
      key={key}
      name='lock'
      tooltip={t('Loaded by the engine, can\'t be configured')}
    />);
  }

  return (
    <div>
    {flags}
    </div>
  );
};

export default translate(['common', 'gamebryo-plugin'], { wait: false })(
    PluginFlags as any
    ) as React.ComponentClass<IBaseProps>;
