import { IExtensionContext, IReducerSpec } from './IExtensionContext';

export interface IExtensionReducer {
  path: string[];
  reducer: IReducerSpec;
}

export interface IExtensionInit {
  (context: IExtensionContext): boolean;
}
