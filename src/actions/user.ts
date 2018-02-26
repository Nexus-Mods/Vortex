import safeCreateAction from './safeCreateAction';

export const setMultiUser = safeCreateAction('SET_MUTLI_USER', (enabled: boolean) => enabled);
