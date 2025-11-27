import { createAction } from 'redux-act';

export const enableMonitor = createAction('ENABLE_SAVEGAME_MONITOR', enabled => enabled);
