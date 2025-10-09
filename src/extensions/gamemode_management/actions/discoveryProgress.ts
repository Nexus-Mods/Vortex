import safeCreateAction from '../../../actions/safeCreateAction';

export const setDiscoveryProgress = safeCreateAction('SET_DISCOVERY_PROGRESS',
  (progress: { current: number; total: number; message: string; gameId?: string }) => progress);

export const setDiscoveryRunning = safeCreateAction('SET_DISCOVERY_RUNNING', (running: boolean) => running);

export const clearDiscoveryProgress = safeCreateAction('CLEAR_DISCOVERY_PROGRESS');