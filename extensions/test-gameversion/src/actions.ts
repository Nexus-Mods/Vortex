import { createAction } from 'redux-act';

export const setGameVersion = createAction('SET_GAME_VERSION',
    (gameId: string, version: string) => ({ gameId, version }));
