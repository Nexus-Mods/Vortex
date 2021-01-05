import safeCreateAction from './safeCreateAction';

/**
 * generic action to store load orders for games. How it is to be interpreted
 * is up to the corresponding game support code.
 * the id will usually be the profile id for which the load order is to be stored, the items
 * in the order could be the ids of mods/plugins - in the order they should be loaded.
 *
 * With most games we don't store the load order this way but instead directly synchronise
 * with the data/configuration file holding the load order.
 * Use this only if that isn't an option (e.g. with "7 days to die" there is no generic way
 * to store the load order, it's only stored in the form of mod names and it would be
 * impractical to redeploy every time the load order is changed)
 */
export const setLoadOrder =
  safeCreateAction('SET_LOAD_ORDER', (id: string, order: any[]) => ({ id, order }));
