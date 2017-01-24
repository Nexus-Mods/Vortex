import {SortDirection} from '../types/SortDirection';

import safeCreateAction from './safeCreateAction';

export const selectRows: any = safeCreateAction('SELECT_ROWS',
  (tableId: string, rowIds: string[], selected: boolean) => ({ tableId, rowIds, selected }));

export const setAttributeVisible: any = safeCreateAction('SET_ATTRIBUTE_VISIBLE',
  (tableId: string, attributeId: string, visible: boolean) => ({ tableId, attributeId, visible }));

export const setAttributeSort: any = safeCreateAction(
    'SET_ATTRIBUTE_SORT',
    (tableId: string, attributeId: string, direction: SortDirection) =>
        ({tableId, attributeId, direction}));
