import { ChildProcess } from 'child_process';
import { SecurityLevel } from './SecurityLevel';

/**
 * Interface for launching processes with different security levels
 */
export interface IProcessLauncher {
  /**
   * Get the security level this launcher provides
   */
  getSecurityLevel(): SecurityLevel;

  /**
   * Launch a process with the configured security level
   *
   * @param exePath Path to the executable
   * @param args Command line arguments
   * @param options Spawn options
   * @returns A ChildProcess or ChildProcess-compatible object
   */
  launch(
    exePath: string,
    args: string[],
    options: ProcessLaunchOptions
  ): Promise<ChildProcess | ChildProcessCompatible>;

  /**
   * Cleanup any resources created during launch
   * Called when the process is disposed
   */
  cleanup(): Promise<void>;

  /**
   * Grant access to additional directories (optional, for sandboxed launchers)
   * Called when the process needs access to new paths during runtime
   *
   * @param paths Paths to grant access to (files or directories)
   */
  grantAdditionalAccess?(paths: string[]): Promise<void>;
}

/**
 * Options for launching a process
 */
export interface ProcessLaunchOptions {
  /**
   * Working directory for the process
   */
  cwd: string;

  /**
   * Environment variables
   */
  env: NodeJS.ProcessEnv;

  /**
   * Standard I/O configuration
   */
  stdio: ['ignore', 'pipe', 'pipe'];

  /**
   * Whether to spawn as detached
   */
  detached: boolean;

  /**
   * Whether to hide the window (Windows only)
   */
  windowsHide: boolean;
}

/**
 * ChildProcess-compatible interface for processes that don't return a real ChildProcess
 * (e.g., processes spawned via RunInContainer)
 */
export interface ChildProcessCompatible {
  stdin: any;
  stdout: NodeJS.EventEmitter;
  stderr: NodeJS.EventEmitter;
  killed: boolean;
  exitCode?: number | null;

  kill(): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}
