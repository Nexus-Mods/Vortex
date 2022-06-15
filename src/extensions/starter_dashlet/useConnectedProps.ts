
import { activeGameId } from '../profile_management/selectors';

import { useTranslation } from 'react-i18next';
import { useSelector, useStore } from 'react-redux';
import { getSafe } from '../../util/storeHelper';
import { IConnectedProps } from './types';

const emptyObj = {};

export const useConnectedProps = (): IConnectedProps => {
  const store = useStore();
  const state = store.getState();
  const gameMode: string = useSelector(activeGameId);
  const [t] = useTranslation();
  return {
    t,
    addToTitleBar: false,
    toolsOrder: [],
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(state, ['settings', 'gameMode',
      'discovered', gameMode, 'tools'], emptyObj),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    toolsRunning: state.session.base.toolsRunning,
  };
};
