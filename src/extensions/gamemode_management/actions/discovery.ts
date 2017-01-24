import safeCreateAction from '../../../actions/safeCreateAction';

export const discoveryProgress: any = safeCreateAction('DISCOVERY_PROGRESS',
  (percent: number, directory: string) => ({ percent, directory }));

export const discoveryFinished: any = safeCreateAction('DISCOVERY_FINISHED');
