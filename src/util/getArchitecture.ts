import * as os from 'os';

/**
 * Gets the real CPU architecture of the hardware, not just the architecture
 * of the running process/binary.
 *
 * This is important for Windows on ARM (WoA) devices where an x64 Electron app
 * running under emulation would report "x64" via os.arch() or process.arch,
 * but we want to know the actual hardware is ARM64.
 *
 * @returns The actual hardware architecture (e.g., "x64", "arm64", "ia32")
 *
 * @example
 * // On ARM64 Windows device running x64 Electron via emulation:
 * process.arch        // Returns "x64" (the binary architecture)
 * os.arch()          // Returns "x64" (the binary architecture)
 * getRealArchitecture() // Returns "arm64" (the actual hardware)
 */
export function getRealArchitecture(): string {
  // On Windows, PROCESSOR_ARCHITEW6432 is set when running a 32-bit or 64-bit
  // process on a different architecture (e.g., x64 on ARM64, x86 on x64).
  // This variable contains the REAL hardware architecture.
  //
  // Examples:
  // - x64 app on ARM64 hardware: PROCESSOR_ARCHITEW6432 = "ARM64"
  // - x86 app on x64 hardware: PROCESSOR_ARCHITEW6432 = "AMD64"
  // - x64 app on x64 hardware: PROCESSOR_ARCHITEW6432 = undefined
  if (process.platform === 'win32' && process.env.PROCESSOR_ARCHITEW6432) {
    const realArch = process.env.PROCESSOR_ARCHITEW6432;

    // Normalize Windows architecture names to Node.js naming convention
    switch (realArch.toUpperCase()) {
      case 'AMD64':
      case 'X64':
        return 'x64';
      case 'ARM64':
        return 'arm64';
      case 'X86':
      case 'IA32':
        return 'ia32';
      case 'ARM':
        return 'arm';
      default:
        return realArch.toLowerCase();
    }
  }

  // On Windows without PROCESSOR_ARCHITEW6432, fall back to PROCESSOR_ARCHITECTURE
  // which shows the running process architecture, but might still be useful
  if (process.platform === 'win32' && process.env.PROCESSOR_ARCHITECTURE) {
    const procArch = process.env.PROCESSOR_ARCHITECTURE;

    switch (procArch.toUpperCase()) {
      case 'AMD64':
      case 'X64':
        return 'x64';
      case 'ARM64':
        return 'arm64';
      case 'X86':
      case 'IA32':
        return 'ia32';
      case 'ARM':
        return 'arm';
      default:
        return procArch.toLowerCase();
    }
  }

  // On non-Windows platforms, os.arch() is generally reliable
  // (macOS handles universal binaries correctly, Linux typically matches)
  return os.arch();
}

/**
 * Gets information about whether the app is running under emulation/translation.
 *
 * @returns Object with emulation details
 */
export function getEmulationInfo(): { isEmulated: boolean; binaryArch: string; hardwareArch: string } {
  const binaryArch = os.arch();
  const hardwareArch = getRealArchitecture();

  return {
    isEmulated: binaryArch !== hardwareArch,
    binaryArch,
    hardwareArch,
  };
}
