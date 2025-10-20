import { IExtension } from './extension';

export interface IRegisteredExtension {
  name: string;
  namespace: string;
  path: string;
  dynamic: boolean;
  initFunc: () => ExtensionInit;
  info?: IExtension;
}

// This type is defined in the ExtensionManager.ts file but we need to export it here
// to avoid circular dependencies
export type ExtensionInit = (context: IExtensionContext) => boolean | Promise<boolean>;

// We need to import IExtensionContext here, but we'll define it minimally to avoid circular dependencies
export interface IExtensionContext {
  // This is a minimal definition to break the circular dependency
  // The full definition is in IExtensionContext.ts
  [key: string]: any;
}