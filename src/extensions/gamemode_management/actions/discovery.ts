import { createAction } from 'redux-act';

export const discoveryProgress: any = createAction('DISCOVERY_PROGRESS',
  (percent: number, directory: string) => ({ percent, directory }));

export const discoveryFinished: any = createAction('DISCOVERY_FINISHED');
