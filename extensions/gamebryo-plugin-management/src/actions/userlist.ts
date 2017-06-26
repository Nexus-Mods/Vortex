import { createAction } from 'redux-act';

export const addRule = createAction('ADD_USERLIST_RULE',
  (gameId, pluginId, reference, type) => ({ gameId, pluginId, reference, type }));

export const removeRule = createAction('REMOVE_USERLIST_RULE',
  (gameId, pluginId, reference, type) => ({ gameId, pluginId, reference, type }));
