import {SortDirection} from '../types/SortDirection';

import {createAction} from 'redux-act';

export const selectRows: any = createAction('SELECT_ROWS',
  (tableId: string, rowIds: string[], selected: boolean) => ({ tableId, rowIds, selected }));

export const setAttributeVisible: any = createAction('SET_ATTRIBUTE_VISIBLE',
  (tableId: string, attributeId: string, visible: boolean) => ({ tableId, attributeId, visible }));

export const setAttributeSort: any = createAction(
    'SET_ATTRIBUTE_SORT',
    (tableId: string, attributeId: string, direction: SortDirection) =>
        ({tableId, attributeId, direction}));
