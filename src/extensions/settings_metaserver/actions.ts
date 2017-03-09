import safeCreateAction from '../../actions/safeCreateAction';

/**
 * add a metaserver
 */
export const addMetaserver = safeCreateAction('ADD_METASERVER',
  (id: string, url: string) => ({ id, url }));

/**
 * remove a metaserver
 */
export const removeMetaserver = safeCreateAction('REMOVE_METASERVER',
  (id: string, cacheDurationSec?: number) => ({ id, cacheDurationSec }));

/**
 * change the priority of a metaserver
 */
export const setPriorities = safeCreateAction('SET_METASERVER_PRIORITY',
  (ids: string[]) => ({ ids }));
