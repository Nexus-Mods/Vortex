import type { InstallFunc } from "./InstallFunc";
import type { TestSupported } from "./TestSupported";

export interface IModInstaller {
  id: string;
  priority: number;
  testSupported: TestSupported;
  install: InstallFunc;
}

export interface ISupportedInstaller {
  installer: IModInstaller;
  requiredFiles: string[];
}
