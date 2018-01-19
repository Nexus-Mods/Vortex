import {IBiDirRule} from './types/IBiDirRule';

import { IReference, RuleType } from 'modmeta-db';
import { createAction } from 'redux-act';

export const setSource = createAction('SET_MOD_CONNECTION_SOURCE',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setTarget = createAction('SET_MOD_CONNECTION_TARGET',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setCreateRule = createAction('SET_MOD_CREATE_RULE',
  (gameId: string, modId: string, reference: IReference, defaultType: string) =>
    ({ gameId, modId, reference, type: defaultType }));

export const closeDialog = createAction('CLOSE_MOD_DEPENDENCY_DIALOG', () => ({}));

export const setType = createAction<RuleType, {}>('SET_MOD_RULE_TYPE');

export const highlightConflictIcon = createAction<boolean, {}>('HIGHLIGHT_CONFLICT_ICON');

export const setConflictInfo = createAction<any, {}>('SET_CONFLICT_INFO');

export const setConflictDialog = createAction('SET_CONFLICT_DIALOG',
  (gameId?: string, modId?: string, modRules?: IBiDirRule[]) => ({ gameId, modId, modRules }));
