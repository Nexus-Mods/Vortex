/**
 * Process launcher implementations for different security levels
 *
 * This module provides a clean interface-based architecture for launching
 * processes with different security restrictions:
 *
 * - Regular: No security restrictions (fallback)
 * - Sandbox: Windows App Container isolation (maximum security)
 */

export { IProcessLauncher, ProcessLaunchOptions, ChildProcessCompatible } from './IProcessLauncher';
export { RegularProcessLauncher } from './RegularProcessLauncher';
export { SandboxProcessLauncher, SandboxLauncherConfig } from './SandboxProcessLauncher';
export { SecurityLevel } from './SecurityLevel';
