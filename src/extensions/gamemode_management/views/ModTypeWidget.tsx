import { IDiscoveryResult, IState } from '../../../types/IState';
import Select, { Option } from 'react-select';
import React from 'react';
import { getModType, getModTypeExtensions } from '../util/modTypeExtensions';
import { IModType } from '../types/IModType';
import { useDispatch, useSelector } from 'react-redux';
import { setModType } from '../../mod_management/actions/mods';
import { getGame } from '../util/getGame';
import { IModWithState } from '../../mod_management/types/IModProps';
import { useTranslation } from 'react-i18next';
import { activeGameId } from '../../profile_management/selectors';
import { midClip, truthy } from '../../../util/util';
import { util } from '../../..';

export interface IModTypeWidget {
  mods: IModWithState | IModWithState[];
}

function ModTypeWidget(props: IModTypeWidget) {
  const mods = Array.isArray(props.mods) ? props.mods : [props.mods];
  
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const modTypeId = mods[0].type;
  
  const gameMode = useSelector<IState, string>(activeGameId);
  const discovery = useSelector<IState, IDiscoveryResult>(state =>
    state.settings.gameMode.discovered[gameMode]);

  const modTypes = React.useMemo(() => getModTypeExtensions(), []);
  const modTypePath = React.useMemo(() => {
    let result = '';
    const game = getGame(gameMode);
    const modType = getModType(modTypeId);
    if ((modType !== undefined) && (game !== undefined)) {
      result = modType.getPath(game);
    } else if (game !== undefined) {
      result = game.getModPaths(discovery?.path)[''];
    }
    return result;
  }, [gameMode, modTypeId]);

  const choices = React.useMemo(() => {
    return modTypes
      .filter((type: IModType) => type.isSupported(gameMode))
      .map((type: IModType) =>
        ({ key: type.typeId, text: (type.options.name || type.typeId || 'Default') }));
  }, [gameMode]);

  const onChangeValue = React.useCallback((newValue: Option<string>) => {
    for (const mod of mods) {
      dispatch(setModType(gameMode, mod.id, newValue?.key || ''));
    }
  }, [gameMode]);
  
  const openPath = React.useCallback(() => {
    util.opn(modTypePath).catch(() => null);
  }, [modTypePath]);

  if (mods[0].state !== 'installed') {
    return <div>{t('Only available for installed mods')}</div>;
  }
  
  if (mods.find(iter => iter.type !== modTypeId) !== undefined) {
    return <div>{t('Multiple')}</div>;
  }

  return (
    <div>
      <Select
        options={choices}
        value={modTypeId}
        onChange={onChangeValue}
        valueKey='key'
        labelKey='text'
      />
      {truthy(modTypePath)
        ? <div>{t('Deploys to')}&nbsp;<a onClick={openPath} title={modTypePath} className='modtype-path'>{midClip(modTypePath, 40)}</a></div>
        : t('Does not deploy')}
    </div>
  );
}

export default ModTypeWidget;
