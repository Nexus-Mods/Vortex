import { createAction } from 'redux-act';

export const discoveryProgress = createAction('DISCOVERY_PROGRESS',
  (percent: number, directory: string) => ({ percent, directory }));

export const discoveryFinished = createAction('DISCOVERY_FINISHED');
