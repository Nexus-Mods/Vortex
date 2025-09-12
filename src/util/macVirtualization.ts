/**
 * macOS virtualization detection utilities for Crossover, Parallels, VMware, and VirtualBox
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { log } from './log';
import { getHomeDirectory } from './platform';

/**
 * Check if Crossover is installed and get its bottle paths
 */
export async function getCrossoverPaths(): Promise<string[]> {
  const homeDir = getHomeDirectory();
  if (!homeDir) {
    return [];
  }

  // Common Crossover installation paths
  const crossoverPaths = [
    path.join(homeDir, 'Applications', 'Crossover'), // User installation
    '/Applications/CrossOver.app', // System installation
  ];

  const bottlePaths: string[] = [];
  
  // Check if Crossover is installed
  for (const crossoverPath of crossoverPaths) {
    try {
      if (await fs.pathExists(crossoverPath)) {
        // Crossover bottles are typically stored in ~/Library/Application Support/CrossOver/Bottles
        const bottlesPath = path.join(homeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles');
        if (await fs.pathExists(bottlesPath)) {
          const bottles = await fs.readdir(bottlesPath);
          for (const bottle of bottles) {
            const bottlePath = path.join(bottlesPath, bottle);
            bottlePaths.push(bottlePath);
          }
        }
        break;
      }
    } catch (err) {
      log('debug', 'Failed to check Crossover installation', { path: crossoverPath, error: err.message });
    }
  }

  return bottlePaths;
}

/**
 * Check if Parallels is installed and get its VM paths
 */
export async function getParallelsPaths(): Promise<string[]> {
  const homeDir = getHomeDirectory();
  if (!homeDir) {
    return [];
  }

  // Common Parallels installation paths
  const parallelsPaths = [
    path.join(homeDir, 'Applications', 'Parallels'), // User VMs
    path.join(homeDir, 'Documents', 'Parallels'), // Older versions
    '/Applications/Parallels Desktop.app', // System installation
  ];

  const vmPaths: string[] = [];
  
  // Check if Parallels is installed
  for (const parallelsPath of parallelsPaths) {
    try {
      if (await fs.pathExists(parallelsPath)) {
        // Parallels VMs are typically stored in ~/Parallels
        const userVMsPath = path.join(homeDir, 'Parallels');
        if (await fs.pathExists(userVMsPath)) {
          const vms = await fs.readdir(userVMsPath);
          for (const vm of vms) {
            if (vm.endsWith('.pvm')) { // Parallels VM files
              const vmPath = path.join(userVMsPath, vm);
              vmPaths.push(vmPath);
            }
          }
        }
        break;
      }
    } catch (err) {
      log('debug', 'Failed to check Parallels installation', { path: parallelsPath, error: err.message });
    }
  }

  return vmPaths;
}

/**
 * Check if VMware Fusion is installed and get its VM paths
 */
export async function getVMwarePaths(): Promise<string[]> {
  const homeDir = getHomeDirectory();
  if (!homeDir) {
    return [];
  }

  // Common VMware Fusion installation paths (checked but not required for VM discovery)
  const vmwareInstallPaths = [
    '/Applications/VMware Fusion.app', // System installation
    path.join(homeDir, 'Applications/VMware Fusion.app'), // User installation
  ];

  const vmPaths: string[] = [];

  // Probe installation paths (for logging/diagnostics only)
  for (const installPath of vmwareInstallPaths) {
    try {
      // Intentionally ignore the result; existence of the app bundle isn't required
      await fs.pathExists(installPath);
    } catch {
      // ignore
    }
  }

  // Primary VM location: ~/Documents/Virtual Machines
  const primaryVMsPath = path.join(homeDir, 'Documents', 'Virtual Machines');
  try {
    if (await fs.pathExists(primaryVMsPath)) {
      const vms = await fs.readdir(primaryVMsPath);
      for (const vm of vms) {
        if (vm.endsWith('.vmwarevm')) {
          vmPaths.push(path.join(primaryVMsPath, vm));
        }
      }
    }
  } catch (err) {
    log('debug', 'Failed to read primary VMware VMs directory', { path: primaryVMsPath, error: (err as Error).message });
  }

  // Fallback/legacy VM location: ~/Virtual Machines
  if (vmPaths.length === 0) {
    const legacyVMsPath = path.join(homeDir, 'Virtual Machines');
    try {
      // Try reading directly; don't gate on pathExists to improve resilience
      const vms = await fs.readdir(legacyVMsPath);
      for (const vm of vms) {
        if (vm.endsWith('.vmwarevm')) {
          vmPaths.push(path.join(legacyVMsPath, vm));
        }
      }
    } catch (err) {
      // If readdir fails, log and continue
      log('debug', 'Failed to read legacy VMware VMs directory', { path: legacyVMsPath, error: (err as Error).message });
    }
  }

  return vmPaths;
}

/**
 * Check if VirtualBox is installed and get its VM paths
 */
export async function getVirtualBoxPaths(): Promise<string[]> {
  const homeDir = getHomeDirectory();
  if (!homeDir) {
    return [];
  }

  // Common VirtualBox installation paths
  const virtualBoxPaths = [
    '/Applications/VirtualBox.app', // System installation
    path.join(homeDir, 'Applications/VirtualBox.app'), // User installation
  ];

  const vmPaths: string[] = [];
  
  // Check if VirtualBox is installed
  for (const virtualBoxPath of virtualBoxPaths) {
    try {
      if (await fs.pathExists(virtualBoxPath)) {
        // VirtualBox VMs are typically stored in ~/VirtualBox VMs
        const userVMsPath = path.join(homeDir, 'VirtualBox VMs');
        if (await fs.pathExists(userVMsPath)) {
          const vms = await fs.readdir(userVMsPath);
          for (const vm of vms) {
            const vmPath = path.join(userVMsPath, vm);
            vmPaths.push(vmPath);
          }
        }
        break;
      }
    } catch (err) {
      log('debug', 'Failed to check VirtualBox installation', { path: virtualBoxPath, error: err.message });
    }
  }

  return vmPaths;
}

/**
 * Get Windows drive paths from Crossover bottles
 */
export async function getCrossoverWindowsDrives(): Promise<string[]> {
  const bottlePaths = await getCrossoverPaths();
  const windowsDrives: string[] = [];

  for (const bottlePath of bottlePaths) {
    try {
      // In Crossover, Windows drives are typically mounted under the bottle directory
      const driveCPath = path.join(bottlePath, 'drive_c');
      if (await fs.pathExists(driveCPath)) {
        windowsDrives.push(driveCPath);
      }
      
      // Check for other drives
      const drives = ['drive_d', 'drive_e', 'drive_f'];
      for (const drive of drives) {
        const drivePath = path.join(bottlePath, drive);
        if (await fs.pathExists(drivePath)) {
          windowsDrives.push(drivePath);
        }
      }
    } catch (err) {
      log('debug', 'Failed to get Crossover Windows drives', { bottlePath, error: err.message });
    }
  }

  return windowsDrives;
}

/**
 * Get Windows drive paths from Parallels VMs
 * Note: This is a simplified approach as accessing Parallels VM filesystems
 * requires mounting or special tools
 */
export async function getParallelsWindowsDrives(): Promise<string[]> {
  const vmPaths = await getParallelsPaths();
  const windowsDrives: string[] = [];

  // Include the global Parallels "Shared Folders" directory under ~/Parallels
  try {
    const homeDir = getHomeDirectory();
    if (homeDir) {
      const globalShared = path.join(homeDir, 'Parallels', 'Shared Folders');
      if (await fs.pathExists(globalShared)) {
        windowsDrives.push(globalShared);
      }
    }
  } catch (err) {
    log('debug', 'Failed to get global Parallels shared folders', { error: (err as Error).message });
  }

  for (const vmPath of vmPaths) {
    try {
      // In Parallels, per-vm shared folders may exist inside the .pvm bundle
      const sharedFolder = path.join(vmPath, 'Shared Folders');
      if (await fs.pathExists(sharedFolder)) {
        windowsDrives.push(sharedFolder);
      }
    } catch (err) {
      log('debug', 'Failed to get Parallels Windows drives', { vmPath, error: (err as Error).message });
    }
  }

  return windowsDrives;
}

/**
 * Get Windows drive paths from VMware VMs
 */
export async function getVMwareWindowsDrives(): Promise<string[]> {
  const vmPaths = await getVMwarePaths();
  const windowsDrives: string[] = [];

  for (const vmPath of vmPaths) {
    try {
      // VMware shared folders are typically accessible
      const sharedFolder = path.join(vmPath, 'Shared Folders');
      if (await fs.pathExists(sharedFolder)) {
        windowsDrives.push(sharedFolder);
      }
      
      // Also check for mounted VM filesystems
      const vmName = path.basename(vmPath, '.vmwarevm');
      const mountedPath = path.join('/Volumes', vmName);
      if (await fs.pathExists(mountedPath)) {
        windowsDrives.push(mountedPath);
      }
    } catch (err) {
      log('debug', 'Failed to get VMware Windows drives', { vmPath, error: err.message });
    }
  }

  return windowsDrives;
}

/**
 * Get Windows drive paths from VirtualBox VMs
 */
export async function getVirtualBoxWindowsDrives(): Promise<string[]> {
  const vmPaths = await getVirtualBoxPaths();
  const windowsDrives: string[] = [];

  for (const vmPath of vmPaths) {
    try {
      // VirtualBox shared folders
      const sharedFolder = path.join(vmPath, 'SharedFolder');
      if (await fs.pathExists(sharedFolder)) {
        windowsDrives.push(sharedFolder);
      }
      
      // Check for mounted VM filesystems
      const vmName = path.basename(vmPath);
      const mountedPath = path.join('/Volumes', vmName);
      if (await fs.pathExists(mountedPath)) {
        windowsDrives.push(mountedPath);
      }
    } catch (err) {
      log('debug', 'Failed to get VirtualBox Windows drives', { vmPath, error: err.message });
    }
  }

  return windowsDrives;
}

/**
 * Get all Windows-compatible drive paths on macOS
 * This includes:
 * 1. Native macOS drives (for native Windows games through tools like Porting Kit)
 * 2. Crossover bottle drives
 * 3. Parallels VM shared folders
 * 4. VMware VM shared folders
 * 5. VirtualBox VM shared folders
 */
export async function getAllWindowsDrivePaths(): Promise<string[]> {
  const drivePaths: string[] = [];

  try {
    // 1. Add standard macOS drives that might contain Windows games
    drivePaths.push('/'); // Root filesystem
    
    // 2. Add Crossover Windows drives
    const crossoverDrives = await getCrossoverWindowsDrives();
    drivePaths.push(...crossoverDrives);
    
    // 3. Add Parallels shared folders
    const parallelsDrives = await getParallelsWindowsDrives();
    drivePaths.push(...parallelsDrives);
    
    // 4. Add VMware shared folders
    const vmwareDrives = await getVMwareWindowsDrives();
    drivePaths.push(...vmwareDrives);
    
    // 5. Add VirtualBox shared folders
    const virtualboxDrives = await getVirtualBoxWindowsDrives();
    drivePaths.push(...virtualboxDrives);
    
    // 6. Add common external drive mount points where Windows games might be installed
    const externalMountPoints = [
      '/Volumes', // Standard macOS mount point for external drives
      path.join(getHomeDirectory(), 'Desktop'),
      path.join(getHomeDirectory(), 'Documents'),
    ];
    
    for (const mountPoint of externalMountPoints) {
      try {
        if (await fs.pathExists(mountPoint)) {
          drivePaths.push(mountPoint);
        }
      } catch (err) {
        log('debug', 'Failed to check mount point', { mountPoint, error: err.message });
      }
    }
  } catch (err) {
    log('warn', 'Failed to get all Windows drive paths', { error: err.message });
  }

  // Remove duplicates and return
  return [...new Set(drivePaths)];
}