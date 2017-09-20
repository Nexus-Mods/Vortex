import {InstallFunc} from './InstallFunc';
import {TestSupported} from './TestSupported';

export interface IModInstaller {
  priority: number;
  testSupported: TestSupported;
  install: InstallFunc;
}
