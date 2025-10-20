import { IExtension } from './shared/extension';

export interface IRegisteredExtension {
  name: string;
  namespace: string;
  path: string;
  dynamic: boolean;
  initFunc: () => any; // Using 'any' to avoid circular dependency with ExtensionInit
  info?: IExtension;
}