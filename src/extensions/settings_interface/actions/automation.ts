import safeCreateAction from '../../../actions/safeCreateAction';

export const setAutoDeployment = safeCreateAction('SET_AUTO_DEPLOYMENT', (enabled: boolean) => enabled);
export const setAutoInstall = safeCreateAction('SET_AUTO_INSTALLATION', (enabled: boolean) => enabled);
export const setAutoEnable = safeCreateAction('SET_AUTO_ENABLE', (enabled: boolean) => enabled);
export const setAutoStart = safeCreateAction('SET_AUTO_START', (enabled: boolean) => enabled);
export const setStartMinimized = safeCreateAction('SET_START_MINIMIZED', (enabled: boolean) => enabled);
