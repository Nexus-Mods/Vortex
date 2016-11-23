import {IInstall} from './IInstall';
import {ITestSupported} from './ITestSupported';

export interface IModInstaller {
  priority: number;
  testSupported: ITestSupported;
  install: IInstall;
}
