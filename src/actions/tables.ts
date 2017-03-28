import {SortDirection} from '../types/SortDirection';

import safeCreateAction from './safeCreateAction';

export const selectRows = safeCreateAction('SELECT_ROWS',
  (tableId: string, rowIds: string[], selected: boolean) => ({ tableId, rowIds, selected }));

export const setAttributeVisible = safeCreateAction('SET_ATTRIBUTE_VISIBLE',
  (tableId: string, attributeId: string, visible: boolean) => ({ tableId, attributeId, visible }));

export const setAttributeSort = safeCreateAction(
    'SET_ATTRIBUTE_SORT',
    (tableId: string, attributeId: string, direction: SortDirection) =>
        ({tableId, attributeId, direction}));

export const setAttributeFilter = safeCreateAction('SET_ATTRIBUTE_FILTER',
  (tableId: string, attributeId?: string, filter?: any) => ({ tableId, attributeId, filter }));

export const setSplitPos = safeCreateAction(
    'SET_SPLIT_POS',
    (tableId: string, pos: number) => ({ tableId, pos }));
