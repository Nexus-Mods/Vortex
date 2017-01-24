import safeCreateAction from '../../../actions/safeCreateAction';

export const storeActivation: any =
    safeCreateAction('STORE_ACTIVATION_SNAPSHOT',
                 (gameId: string, activationId: string, snapshot: any) =>
                     ({gameId, activationId, snapshot}));
