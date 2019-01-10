import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setDeploymentNecessary = safeCreateAction('SET_NEED_DEPLOYMENT',
  (gameId: string, required: boolean) => ({ gameId, required }));
