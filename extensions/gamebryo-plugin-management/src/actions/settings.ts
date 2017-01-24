import { safeCreateAction } from 'nmm-api';

/**
 * change whether an attribute is displayed in the mod list
 */
export const setPluginlistAttributeVisible: any = safeCreateAction(
  'SET_PLUGINLIST_ATTRIBUTE_VISIBLE',
  (attributeId: string, visible: boolean) => { return { attributeId, visible }; } );

/**
 * sets if/how to sort by an attribute
 */
export const setPluginlistAttributeSort: any = safeCreateAction('SET_PLUGINLIST_ATTRIBUTE_SORT',
  (attributeId: string, direction: string) => { return { attributeId, direction }; } );

/**
 * enables or disables autosort
 */
export const setAutoSortEnabled: any = safeCreateAction('SET_AUTOSORT_ENABLED');
