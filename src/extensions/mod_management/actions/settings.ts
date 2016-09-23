import { createAction } from 'redux-act';

export const setPath = createAction('set a path',
  (key: string, path: string) => { return { key, path }; });
