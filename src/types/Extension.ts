import { IExtensionContext, IReducerSpec } from './IExtensionContext';

export interface IExtensionReducer {
  path: string[];
  reducer: IReducerSpec;
}

export type ExtensionInit = (context: IExtensionContext) => boolean;
