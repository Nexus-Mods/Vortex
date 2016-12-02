import { createAction } from 'redux-act';

/**
 * change whether an attribute is displayed in the mod list
 */
export const setPluginlistAttributeVisible: any = createAction('SET_PLUGINLIST_ATTRIBUTE_VISIBLE',
  (attributeId: string, visible: boolean) => { return { attributeId, visible }; } );

/**
 * sets if/how to sort by an attribute
 */
export const setPluginlistAttributeSort: any = createAction('SET_PLUGINLIST_ATTRIBUTE_SORT',
  (attributeId: string, direction: string) => { return { attributeId, direction }; } );
