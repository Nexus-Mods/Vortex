import lazyRequire from "../../../renderer/util/lazyRequire";
import type { LogLevel } from "../../../renderer/util/log";
import { log } from "../../../renderer/util/log";

import type * as fomodT from "fomod-installer-native";

const getLogLevel = (level: number): LogLevel => {
  switch (level) {
    case 0:
      return "debug";
    case 1:
      return "debug";
    case 2:
      return "info";
    case 3:
      return "warn";
    case 4:
      return "error";
    case 5:
      return "error";
  }
  return "debug";
};

export class VortexModInstallerLogger {
  private fomod: typeof fomodT;
  private mLogger: fomodT.NativeLogger;

  public constructor() {
    this.fomod = lazyRequire<typeof fomodT>(() =>
      require("fomod-installer-native"),
    );
    this.mLogger = new this.fomod.NativeLogger(this.log);
  }

  public useVortexFunctions = () => {
    this.mLogger.setCallbacks();
  };

  public useLibraryFunctions = () => {
    this.fomod.NativeLogger.setDefaultCallbacks();
  };

  /**
   * Callback
   */
  private log = (level: number, message: string): void => {
    const logLevel = getLogLevel(level);
    log(logLevel, message);
  };
}
