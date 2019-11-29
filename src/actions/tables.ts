import {SortDirection} from '../types/SortDirection';

import safeCreateAction from './safeCreateAction';

import * as reduxAct from 'redux-act';

export const setAttributeVisible = safeCreateAction('SET_ATTRIBUTE_VISIBLE',
  (tableId: string, attributeId: string, visible: boolean) => ({ tableId, attributeId, visible }));

export const setAttributeSort = safeCreateAction(
    'SET_ATTRIBUTE_SORT',
    (tableId: string, attributeId: string, direction: SortDirection) =>
        ({tableId, attributeId, direction}));

export const setAttributeFilter = safeCreateAction('SET_ATTRIBUTE_FILTER',
  (tableId: string, attributeId: string, filter: any) => ({ tableId, attributeId, filter }));

export const setGroupingAttribute = safeCreateAction('SET_GROUPING_ATTRIBUTE',
  (tableId: string, attributeId: string) => ({ tableId, attributeId }));

export const collapseGroup = safeCreateAction('COLLAPSE_GROUP',
  (tableId: string, groupId: string, collapse: boolean) => ({ tableId, groupId, collapse }));

export const setCollapsedGroups = safeCreateAction('SET_COLLAPSED_GROUPS',
  (tableId: string, groups: string[]) => ({ tableId, groups }));
