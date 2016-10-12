import { createAction } from 'redux-act';

/**
 * change a path (base, download or installation) for
 * storing things. Supports placeholders
 */
export const setPath = createAction('SET_MOD_PATH',
  (key: string, path: string) => { return { key, path }; });

/**
 * change whether an attribute is displayed in the mod list
 */
export const setModlistAttributeVisible = createAction('SET_MODLIST_ATTRIBUTE_VISIBLE',
  (attributeId: string, visible: boolean) => { return { attributeId, visible }; } );

/**
 * sets if/how to sort by an attribute
 */
export const setModlistAttributeSort = createAction('SET_MODLIST_ATTRIBUTE_SORT',
  (attributeId: string, direction: string) => { return { attributeId, direction }; } );

/**
 * sets the activator to use for this game
 */
export const setActivator = createAction('SET_ACTIVATOR');
