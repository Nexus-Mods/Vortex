/**
 * Security level for FOMOD installer process
 */
export enum SecurityLevel {
  /**
   * Regular process - no special security restrictions
   * Used as fallback when sandboxing fails or is disabled
   */
  Regular = 'regular',

  /**
   * Windows App Container sandbox - isolated process with restricted access
   * Provides strong security isolation but may fail on some systems
   */
  Sandbox = 'sandbox',
}

/**
 * Configuration for sandboxed process execution
 */
export interface SandboxConfig {
  /**
   * Security level to use
   */
  securityLevel: SecurityLevel;

  /**
   * App Container name (for Sandbox level)
   */
  containerName?: string;

  /**
   * Whether to allow fallback to Regular if Sandbox fails
   */
  allowFallback: boolean;

  /**
   * App Container capabilities to grant (for Sandbox level)
   * Note: Currently not used - winapi-bindings doesn't provide a way to grant custom capabilities
   * App Containers created via winapi-bindings have default permissions which allow UI windows
   */
  capabilities?: string[];
}

/**
 * Check if the current OS supports Windows App Container
 * App Containers require Windows 8+ with proper configuration
 */
export function osSupportsAppContainer(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const winapi = require('winapi-bindings');
    return winapi?.GrantAppContainer !== undefined;
  } catch (err) {
    return false;
  }
}

/**
 * Get default sandbox configuration based on settings and system capabilities
 */
export function getDefaultSandboxConfig(
  sandboxEnabled: boolean,
  containerNameBase: string
): SandboxConfig {
  const useAppContainer = osSupportsAppContainer() && sandboxEnabled;

  return {
    securityLevel: useAppContainer ? SecurityLevel.Sandbox : SecurityLevel.Regular,
    containerName: useAppContainer ? containerNameBase : undefined,
    allowFallback: true,
    // Capabilities are not used - winapi-bindings App Containers allow UI by default
    capabilities: undefined,
  };
}
