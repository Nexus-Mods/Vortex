import {InstallFunc} from './InstallFunc';
import {TestSupported} from './TestSupported';

export interface IModInstaller {
  priority: number;
  testSupported: TestSupported;
  install: InstallFunc;
}

export interface ISupportedInstaller {
  installer: IModInstaller;
  requiredFiles: string[];
}
