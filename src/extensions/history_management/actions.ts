import safeCreateAction from '../../actions/safeCreateAction';
import { IHistoryEvent } from './types';

export const addHistoryEvent = safeCreateAction('HISTORY_ADD_EVENT',
  (stack: string, event: IHistoryEvent, limit: number) => ({ stack, event, limit }));

export const markHistoryReverted = safeCreateAction('HISTORY_MARK_REVERTED',
  (stack: string, event: IHistoryEvent) => ({ stack, event }));

export const showHistory = safeCreateAction('HISTORY_SHOW',
  (stack: string) => stack);
