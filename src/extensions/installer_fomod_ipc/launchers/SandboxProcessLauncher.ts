import { EventEmitter } from 'events';
import * as path from 'path';
import * as winapi from 'winapi-bindings';
import { IProcessLauncher, ProcessLaunchOptions, ChildProcessCompatible } from './IProcessLauncher';
import { SecurityLevel } from './SecurityLevel';
import { ITransport } from '../transport/ITransport';
import { NamedPipeTransport } from '../transport/NamedPipeTransport';
import { log } from '../../../util/log';

/**
 * Configuration for sandbox launcher
 */
export interface SandboxLauncherConfig {
  /**
   * App Container name (must be unique)
   */
  containerName: string;

  /**
   * Optional transport to configure for sandbox access
   * If provided and is a NamedPipeTransport, will automatically grant ACL permissions
   */
  transport?: ITransport;
}

/**
 * Sandbox process launcher - Windows App Container isolation
 * Provides maximum security by running process in isolated container
 */
export class SandboxProcessLauncher implements IProcessLauncher {
  private containerName: string;
  private transport?: ITransport;

  public constructor(config: SandboxLauncherConfig) {
    this.containerName = config.containerName;
    this.transport = config.transport;

    // If a named pipe transport was provided, configure it for sandbox access
    if (this.transport instanceof NamedPipeTransport) {
      this.configureNamedPipeTransport(this.transport);
    }
  }

  /**
   * Configure a NamedPipeTransport for sandbox access
   * Sets up the callback to grant App Container permissions during server creation
   */
  private configureNamedPipeTransport(transport: NamedPipeTransport): void {
    const originalCreateServers = transport.createServers.bind(transport);

    // Wrap createServers to automatically inject our ACL callback
    transport.createServers = async (onCreated?) => {
      // Create a combined callback that calls both our ACL setup and any user callback
      const combinedCallback = async (pipeId: string) => {
        // First, grant our ACL permissions
        this.grantNamedPipeAccess(transport);

        // Then call any user-provided callback
        if (onCreated) {
          await onCreated(pipeId);
        }
      };

      return originalCreateServers(combinedCallback);
    };
  }

  public getSecurityLevel(): SecurityLevel {
    return SecurityLevel.Sandbox;
  }

  /**
   * Create a callback function for granting App Container access to named pipes
   * This callback can be passed to transport.createServers(onCreated)
   *
   * @param transport The NamedPipeTransport instance to grant access to
   * @returns Callback function that grants pipe access
   */
  public createPipeAccessCallback(transport: NamedPipeTransport): () => void {
    return () => {
      this.grantNamedPipeAccess(transport);
    };
  }

  /**
   * Grant App Container access to named pipes
   * This is called via the callback pattern to decouple transport from sandbox details
   *
   * @param transport The NamedPipeTransport instance
   */
  private grantNamedPipeAccess(transport: NamedPipeTransport): void {
    if (process.platform !== 'win32') {
      log('debug', 'Named pipe ACL only needed on Windows', {
        platform: process.platform
      });
      return;
    }

    const pipePaths = transport.getPipePaths();
    if (!pipePaths) {
      log('warn', 'Cannot grant pipe access - pipes not initialized', {
        containerName: this.containerName
      });
      return;
    }

    try {
      // Grant access to outbound pipe (Node writes, C# reads)
      winapi.GrantAppContainer(
        this.containerName,
        pipePaths.outbound,
        'named_pipe',
        ['all_access']
      );
      log('debug', 'Granted App Container access to outbound pipe', {
        containerName: this.containerName,
        pipePath: pipePaths.outbound
      });

      // Grant access to inbound pipe (C# writes, Node reads)
      winapi.GrantAppContainer(
        this.containerName,
        pipePaths.inbound,
        'named_pipe',
        ['all_access']
      );
      log('debug', 'Granted App Container access to inbound pipe', {
        containerName: this.containerName,
        pipePath: pipePaths.inbound
      });

      log('info', 'Granted App Container access to named pipes', {
        containerName: this.containerName
      });
    } catch (err) {
      log('error', 'Failed to grant App Container access to pipes', {
        containerName: this.containerName,
        outbound: pipePaths.outbound,
        inbound: pipePaths.inbound,
        error: err.message
      });
      throw err;
    }
  }

  public async launch(
    exePath: string,
    args: string[],
    options: ProcessLaunchOptions
  ): Promise<ChildProcessCompatible> {
    log('debug', 'Launching process with App Container sandbox', {
      exePath,
      args,
      cwd: options.cwd,
      containerName: this.containerName
    });

    // Delete existing container to ensure clean state
    try {
      winapi.DeleteAppContainer(this.containerName);
      log('debug', 'Deleted existing App Container', {
        containerName: this.containerName
      });
    } catch (err) {
      // Ignore errors - container might not exist
    }

    // Create new App Container
    winapi.CreateAppContainer(
      this.containerName,
      'Vortex FOMOD Installer',
      'Sandboxed FOMOD installer process'
    );

    log('info', 'Created App Container', {
      containerName: this.containerName
    });

    // Grant access to the executable and its directory
    this.grantFileSystemAccess(exePath, options.cwd);

    // Build command line
    const commandLine = `"${exePath}" ${args.join(' ')}`;

    // Create a pseudo-ChildProcess object to maintain API compatibility
    const pseudoProcess = this.createPseudoProcess();

    // Run in container using winapi-bindings API
    log('debug', 'Running process in App Container', {
      containerName: this.containerName,
      commandLine
    });

    winapi.RunInContainer(
      this.containerName,
      commandLine,
      options.cwd,
      (code: number) => {
        pseudoProcess.exitCode = code;
        pseudoProcess.emit('exit', code, null);
        log('debug', 'Sandboxed process exited', {
          code,
          containerName: this.containerName
        });
      },
      (message: string) => {
        // Emit to stdout (winapi doesn't distinguish stdout/stderr)
        pseudoProcess.stdout.emit('data', Buffer.from(message, 'utf8'));
      }
    );

    log('info', 'Process launched successfully in App Container', {
      containerName: this.containerName
    });

    return pseudoProcess;
  }

  public async cleanup(): Promise<void> {
    // Delete App Container
    try {
      winapi.DeleteAppContainer(this.containerName);
      log('debug', 'Deleted App Container during cleanup', {
        containerName: this.containerName
      });
    } catch (err) {
      log('warn', 'Error deleting App Container during cleanup', {
        containerName: this.containerName,
        error: err.message
      });
    }
  }

  /**
   * Grant App Container access to the executable and necessary directories
   */
  private grantFileSystemAccess(exePath: string, cwd: string): void {
    try {
      const exeDir = path.dirname(exePath);

      // Grant access to the directory containing the executable (read + traverse + list)
      // This provides access to all files within the directory without needing to grant
      // access to each file individually, which significantly improves performance
      log('debug', 'Starting to grant access to exe directory', { exeDir });
      const startExeDir = Date.now();
      winapi.GrantAppContainer(
        this.containerName,
        exeDir,
        'file_object',
        ['generic_read', 'generic_execute', 'traverse', 'list_directory']
      );
      log('debug', 'Granted access to exe directory', {
        exeDir,
        durationMs: Date.now() - startExeDir
      });

      // Grant access to working directory if different from exe directory
      if (cwd && path.resolve(cwd) !== path.resolve(exeDir)) {
        try {
          log('debug', 'Starting to grant access to working directory', { cwd });
          const startCwd = Date.now();
          winapi.GrantAppContainer(
            this.containerName,
            cwd,
            'file_object',
            ['generic_read', 'traverse', 'list_directory']
          );
          log('debug', 'Granted access to working directory', {
            cwd,
            durationMs: Date.now() - startCwd
          });
        } catch (cwdErr) {
          log('debug', 'Failed to grant access to working directory', {
            cwd,
            error: cwdErr.message
          });
        }
      }

      // NOTE: TEMP directory access disabled - takes 12+ seconds due to large number of files
      // ModInstallerIPC.exe appears to work without it (self-contained .NET executable)
      // If issues arise, consider creating a dedicated temp subdirectory instead
      // const tempDir = os.tmpdir();
      // try {
      //   log('debug', 'Starting to grant access to TEMP directory', { tempDir });
      //   const startTemp = Date.now();
      //   winapi.GrantAppContainer(
      //     this.containerName,
      //     tempDir,
      //     'file_object',
      //     ['generic_read', 'generic_write', 'traverse', 'list_directory']
      //   );
      //   log('debug', 'Granted access to TEMP directory', {
      //     tempDir,
      //     durationMs: Date.now() - startTemp
      //   });
      // } catch (tempErr) {
      //   log('debug', 'Failed to grant access to TEMP directory', {
      //     tempDir,
      //     error: tempErr.message
      //   });
      // }

      log('info', 'Granted App Container file system access', {
        exeDir
      });
    } catch (err) {
      log('warn', 'Failed to grant file access to App Container', {
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Grant access to additional directories after process launch
   * This is needed when the process needs to access paths not known at launch time
   * (e.g., mod installation directories)
   */
  public async grantAdditionalAccess(paths: string[]): Promise<void> {
    for (const dirPath of paths) {
      try {
        log('debug', 'Granting App Container access to additional path', { path: dirPath });
        const startTime = Date.now();

        winapi.GrantAppContainer(
          this.containerName,
          dirPath,
          'file_object',
          ['generic_read', 'traverse', 'list_directory']
        );

        log('info', 'Granted App Container access to additional path', {
          path: dirPath,
          durationMs: Date.now() - startTime
        });
      } catch (err) {
        log('error', 'Failed to grant App Container access to additional path', {
          path: dirPath,
          error: err.message
        });
        throw err;
      }
    }
  }

  /**
   * Create a pseudo-ChildProcess object that emulates the ChildProcess API
   * This is needed because RunInContainer uses callbacks instead of returning a ChildProcess
   */
  private createPseudoProcess(): ChildProcessCompatible {
    const pseudoProcess: any = new EventEmitter();
    pseudoProcess.stdin = null;
    pseudoProcess.stdout = new EventEmitter();
    pseudoProcess.stdout.on = pseudoProcess.stdout.addListener.bind(pseudoProcess.stdout);
    pseudoProcess.stderr = new EventEmitter();
    pseudoProcess.stderr.on = pseudoProcess.stderr.addListener.bind(pseudoProcess.stderr);
    pseudoProcess.killed = false;
    pseudoProcess.exitCode = null;
    pseudoProcess.kill = () => {
      pseudoProcess.killed = true;
      // Note: winapi-bindings doesn't provide a kill mechanism for RunInContainer
      return true;
    };

    return pseudoProcess;
  }
}
