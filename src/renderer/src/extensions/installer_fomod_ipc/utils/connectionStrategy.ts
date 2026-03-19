import type { ConnectionStrategy } from "fomod-installer-ipc";
import {
  NamedPipeTransport,
  RegularProcessLauncher,
  SandboxProcessLauncher,
  SecurityLevel,
  TCPTransport,
} from "fomod-installer-ipc";

/**
 * Helper function to create connection strategies from launcher options
 */
export const createConnectionStrategies = (options?: {
  securityLevel?: SecurityLevel;
  allowFallback?: boolean;
  containerName?: string;
}): ConnectionStrategy[] => {
  const strategies: ConnectionStrategy[] = [];

  const securityLevel = options?.securityLevel || SecurityLevel.Sandbox;
  const allowFallback = options?.allowFallback !== false;
  const containerName = options?.containerName || "fomod_installer";

  if (securityLevel === SecurityLevel.Sandbox) {
    const namedPipeTransport = new NamedPipeTransport();
    const sandboxLauncher = new SandboxProcessLauncher({
      containerName,
      transport: namedPipeTransport,
    });

    // Named Pipe with sandbox launcher (ACL configuration handled automatically)
    strategies.push({
      transport: namedPipeTransport,
      launcher: sandboxLauncher,
    });
  }

  if (
    (securityLevel === SecurityLevel.Sandbox && allowFallback) ||
    securityLevel === SecurityLevel.Regular
  ) {
    // Named Pipe with regular launcher
    strategies.push({
      transport: new NamedPipeTransport(),
      launcher: new RegularProcessLauncher(),
    });
  }

  if (
    (securityLevel === SecurityLevel.Sandbox && allowFallback) ||
    (securityLevel === SecurityLevel.Regular && allowFallback)
  ) {
    // TCP with regular launcher
    strategies.push({
      transport: new TCPTransport(),
      launcher: new RegularProcessLauncher(),
    });
  }

  return strategies;
};
