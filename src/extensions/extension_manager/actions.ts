import { createAction } from 'redux-act';
import { IAvailableExtension, IExtension } from './types';

export const setAvailableExtensions = createAction('SET_AVAILABLE_EXTENSIONS',
  (extensions: IAvailableExtension[]) => extensions);

export const setInstalledExtensions = createAction('SET_INSTALLED_EXTENSIONS',
  (extensions: { [extId: string]: IExtension }) => extensions);

export const setExtensionsUpdate = createAction('SET_EXTENSIONS_UPDATE_TIME',
  (time: number) => time);
