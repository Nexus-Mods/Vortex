import { spawn, ChildProcess } from 'child_process';
import { IProcessLauncher, ProcessLaunchOptions } from './IProcessLauncher';
import { SecurityLevel } from './SecurityLevel';
import { log } from '../../../util/log';

/**
 * Regular process launcher - no security restrictions
 * Used as fallback when sandboxing is unavailable or disabled
 */
export class RegularProcessLauncher implements IProcessLauncher {
  public getSecurityLevel(): SecurityLevel {
    return SecurityLevel.Regular;
  }

  public async launch(
    exePath: string,
    args: string[],
    options: ProcessLaunchOptions
  ): Promise<ChildProcess> {
    log('debug', 'Launching process with regular security', {
      exePath,
      args,
      cwd: options.cwd
    });

    const process = spawn(exePath, args, options);

    log('info', 'Process launched successfully (regular security)', {
      pid: process.pid
    });

    return process;
  }

  public async cleanup(): Promise<void> {
    // No cleanup needed for regular processes
  }
}
