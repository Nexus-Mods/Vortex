import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setPhaseCount = safeCreateAction('SET_DISCOVERY_PHASE_COUNT', count => count);

export const discoveryProgress = safeCreateAction('DISCOVERY_PROGRESS',
  (idx: number, percent: number, directory: string) => ({ idx, percent, directory }));

export const discoveryFinished = safeCreateAction('DISCOVERY_FINISHED');
