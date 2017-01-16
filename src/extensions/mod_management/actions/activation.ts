import { createAction } from 'redux-act';

export const storeActivation: any =
    createAction('STORE_ACTIVATION_SNAPSHOT',
                 (gameId: string, activationId: string, snapshot: any) =>
                     ({gameId, activationId, snapshot}));
