import { IExtensionState } from '../../types/IState';

export interface IExtension {
  name: string;
  author: string;
  description: string;
  version: string;
  bundled?: boolean;
}

export type IExtensionWithState = IExtension & IExtensionState;
