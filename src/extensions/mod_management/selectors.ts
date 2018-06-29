import { IState } from '../../types/IState';
import { activeGameId } from '../../util/selectors';

import getInstallPath from './util/getInstallPath';

import * as path from 'path';
import { createSelector } from 'reselect';

const installPathPattern = (state: IState) => state.settings.mods.installPath;

export const installPath = createSelector(installPathPattern, activeGameId,
    (inPaths: { [gameId: string]: string }, inGameMode: string) => {
      if (inGameMode === undefined) {
        return undefined;
      }
      return getInstallPath(inPaths[inGameMode], inGameMode);
    });

export const currentActivator =
  (state: IState): string => state.settings.mods.activator[activeGameId(state)];
