import { createAction } from 'redux-act';

/**
 * add a metaserver
 */
export const addMetaserver: any = createAction('ADD_METASERVER',
  (url: string) => ({ url }));

/**
 * remove a metaserver
 */
export const removeMetaserver: any = createAction('REMOVE_METASERVER',
  (id: string, cacheDurationSec?: number) => ({ id, cacheDurationSec }));

/**
 * change the priority of a metaserver
 */
export const setPriorities: any = createAction('SET_METASERVER_PRIORITY',
  (ids: string[]) => ({ ids }));
