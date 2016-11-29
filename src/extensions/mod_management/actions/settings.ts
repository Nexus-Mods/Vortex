import { createAction } from 'redux-act';

/**
 * change a path (base, download or installation) for
 * storing things. Supports placeholders
 */
export const setPath: any = createAction('SET_MOD_PATH',
  (key: string, path: string) => { return { key, path }; });

/**
 * change whether an attribute is displayed in the mod list
 */
export const setModlistAttributeVisible: any = createAction('SET_MODLIST_ATTRIBUTE_VISIBLE',
  (attributeId: string, visible: boolean) => { return { attributeId, visible }; } );

/**
 * sets if/how to sort by an attribute
 */
export const setModlistAttributeSort: any = createAction('SET_MODLIST_ATTRIBUTE_SORT',
  (attributeId: string, direction: string) => { return { attributeId, direction }; } );

/**
 * sets the activator to use for this game
 */
export const setActivator: any = createAction('SET_ACTIVATOR');
