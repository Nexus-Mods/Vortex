import { types } from 'vortex-api';

export interface IPatcherProps {
  extensionPath: string;
  dataPath: string;
  entryPoint: string;
  remove: boolean;
  modsPath: string;
  context?: types.IExtensionContext;
  injectVIGO?: boolean;
  unityEngineDir?: string;
}
