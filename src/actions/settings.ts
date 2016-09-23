import { IDiscoveryResult } from '../types/IState';

import { createAction } from 'redux-act';

export const setGameMode = createAction('change game being managed');

export const addDiscoveredGame =
  createAction('add info about a discovered game',
    (id: string, result: IDiscoveryResult) => { return { id, result }; });
