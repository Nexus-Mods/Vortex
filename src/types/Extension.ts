import { IExtensionContext } from './IExtensionContext';

export interface IExtensionReducer {
  path: string[];
  reducer: Function;
}

export interface IExtensionInit {
  (context: IExtensionContext): boolean;
}
