import { log, LogLevel } from '../../../util/log';
import { NativeLogger, types as vetypes } from 'fomod-installer-native';

const getLogLevel = (level: number): LogLevel => {
  switch (level) {
    case 0: return 'debug';
    case 1: return 'debug';
    case 2: return 'info';
    case 3: return 'warn';
    case 4: return 'error';
    case 5: return 'error';
  }
  return 'debug';
}

export class VortexModInstallerLogger {
  private mLogger: NativeLogger;

  public constructor() {
    this.mLogger = new NativeLogger(
      this.log
    );
  }

  public useVortexFuntions = () => {
    this.mLogger.setCallbacks();
  }

  public useLibraryFunctions = () => {
    NativeLogger.setDefaultCallbacks();
  }

  /**
   * Callback
   */
  private log = (level: number, message: string): void => {
    const logLevel = getLogLevel(level);
    log(logLevel, message);
  };
}