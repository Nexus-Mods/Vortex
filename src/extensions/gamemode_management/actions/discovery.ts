import safeCreateAction from '../../../actions/safeCreateAction';

export const discoveryProgress = safeCreateAction('DISCOVERY_PROGRESS',
  (percent: number, directory: string) => ({ percent, directory }));

export const discoveryFinished = safeCreateAction('DISCOVERY_FINISHED');
