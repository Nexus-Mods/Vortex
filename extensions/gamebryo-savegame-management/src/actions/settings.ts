import { createAction } from 'redux-act';

export const setSavegamelistAttributeVisible: any =
    createAction('SET_SAVEGAMELIST_ATTRIBUTE_VISIBLE',
                 (attributeId: string, visible: boolean) => {
                   return {attributeId, visible};
                 });

export const setSavegamelistAttributeSort: any = createAction('SET_SAVEGAMELIST_ATTRIBUTE_SORT',
  (attributeId: string, direction: string) => { return { attributeId, direction }; });
