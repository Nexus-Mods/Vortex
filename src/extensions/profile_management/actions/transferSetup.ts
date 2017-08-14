import { createAction } from 'redux-act';

import { IProfile } from '../types/IProfile';

export const setSource = createAction('SET_PROFILE_CONNECTION_SOURCE',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setTarget = createAction('SET_PROFILE_CONNECTION_TARGET',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setCreateTransfer = createAction('SET_PROFILE_TRANSFER',
  (gameId: string, source: string, target: string) =>
    ({ gameId, source, target }));

export const closeDialog = createAction('CLOSE_PROFILE_TRANSFER_DIALOG');
