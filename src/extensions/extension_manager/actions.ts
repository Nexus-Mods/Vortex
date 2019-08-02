import { createAction } from 'redux-act';
import { IAvailableExtension } from './types';

export const setAvailableExtensions = createAction('SET_AVAILABLEEXTENSIONS',
  (extensions: IAvailableExtension[]) => extensions);
