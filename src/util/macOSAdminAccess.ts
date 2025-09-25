import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { log } from './log';
import { isMacOS } from './platform';

const access = promisify(fs.access);
const stat = promisify(fs.stat);

export interface IPermissionResult {
  hasAccess: boolean;
  canRequestAdmin: boolean;
  adminGranted?: boolean;
  error?: string;
}

export interface IAdminRequestOptions {
  reason?: string;
  icon?: string;
  prompt?: string;
}

/**
 * macOS Admin Access Manager
 * Handles admin privilege requests for file operations and deployment
 */
export class MacOSAdminAccessManager {
  private static instance: MacOSAdminAccessManager;
  private adminAccessCache: Map<string, boolean> = new Map();
  private adminRequestInProgress: Set<string> = new Set();

  public static getInstance(): MacOSAdminAccessManager {
    if (!MacOSAdminAccessManager.instance) {
      MacOSAdminAccessManager.instance = new MacOSAdminAccessManager();
    }
    return MacOSAdminAccessManager.instance;
  }

  /**
   * Check if we have write access to a directory
   */
  public async checkWriteAccess(dirPath: string): Promise<IPermissionResult> {
    if (!isMacOS()) {
      // On non-macOS platforms, just do a simple access check
      try {
        await access(dirPath, fs.constants.W_OK);
        return { hasAccess: true, canRequestAdmin: false };
      } catch (error) {
        return { hasAccess: false, canRequestAdmin: false, error: error.message };
      }
    }

    try {
      await access(dirPath, fs.constants.W_OK);
      log('debug', 'Write access confirmed', { path: dirPath });
      return {
        hasAccess: true,
        canRequestAdmin: false
      };
    } catch (error) {
      log('debug', 'Write access denied', { path: dirPath, error: error.message });
      
      // Check if this is a permission issue that could be resolved with admin access
      const canRequestAdmin = await this.canRequestAdminForPath(dirPath);
      
      return {
        hasAccess: false,
        canRequestAdmin,
        error: error.message
      };
    }
  }

  /**
   * Request admin access for a specific path
   */
  public async requestAdminAccess(
    dirPath: string, 
    options: IAdminRequestOptions = {}
  ): Promise<boolean> {
    if (!isMacOS()) {
      log('debug', 'Admin access not supported on non-macOS platforms');
      return false;
    }

    const cacheKey = path.resolve(dirPath);
    
    // Check cache first
    if (this.adminAccessCache.has(cacheKey)) {
      const cached = this.adminAccessCache.get(cacheKey);
      log('debug', 'Using cached admin access result', { path: dirPath, granted: cached });
      return cached;
    }

    // Prevent multiple simultaneous requests for the same path
    if (this.adminRequestInProgress.has(cacheKey)) {
      log('debug', 'Admin request already in progress for path', { path: dirPath });
      return false;
    }

    this.adminRequestInProgress.add(cacheKey);

    try {
      const granted = await this.executeAdminRequest(dirPath, options);
      
      // Cache the result for 5 minutes
      this.adminAccessCache.set(cacheKey, granted);
      setTimeout(() => {
        this.adminAccessCache.delete(cacheKey);
      }, 5 * 60 * 1000);

      log('info', 'Admin access request completed', { path: dirPath, granted });
      return granted;
    } catch (error) {
      log('error', 'Admin access request failed', { path: dirPath, error: error.message });
      return false;
    } finally {
      this.adminRequestInProgress.delete(cacheKey);
    }
  }

  /**
   * Execute the actual admin access request using osascript
   */
  private async executeAdminRequest(
    dirPath: string, 
    options: IAdminRequestOptions
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const reason = options.reason || 'Vortex needs administrator access to deploy mods to this location.';
      const prompt = options.prompt || 'Enter your password to allow Vortex to modify game files:';
      
      // Use osascript to show admin authentication dialog
      const script = `
        try
          do shell script "test -w '${dirPath.replace(/'/g, "'\\''")}' || exit 1" with administrator privileges with prompt "${prompt}"
          return "granted"
        on error
          return "denied"
        end try
      `;

      const osascript = spawn('osascript', ['-e', script]);
      let output = '';
      let errorOutput = '';

      osascript.stdout.on('data', (data) => {
        output += data.toString();
      });

      osascript.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      osascript.on('close', (code) => {
        const granted = output.trim() === 'granted';
        
        if (code === 0 && granted) {
          log('info', 'Admin access granted via osascript', { path: dirPath });
          resolve(true);
        } else {
          log('info', 'Admin access denied or cancelled', { 
            path: dirPath, 
            code, 
            output: output.trim(),
            error: errorOutput.trim()
          });
          resolve(false);
        }
      });

      osascript.on('error', (error) => {
        log('error', 'Failed to execute osascript for admin request', { 
          path: dirPath, 
          error: error.message 
        });
        resolve(false);
      });
    });
  }

  /**
   * Check if we can potentially request admin access for a path
   */
  private async canRequestAdminForPath(dirPath: string): Promise<boolean> {
    try {
      // Check if the directory exists
      const stats = await stat(dirPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check if this looks like a system or protected directory
      const resolvedPath = path.resolve(dirPath);
      
      // Common paths where admin access might help
      const adminPaths = [
        '/Applications',
        '/Library',
        '/System',
        '/usr',
        '/opt',
        '/Volumes'
      ];

      const isAdminPath = adminPaths.some(adminPath => 
        resolvedPath.startsWith(adminPath)
      );

      // Also check for Steam directories which commonly need admin access
      const isSteamPath = resolvedPath.includes('Steam') || 
                         resolvedPath.includes('steamapps');

      return isAdminPath || isSteamPath;
    } catch (error) {
      log('debug', 'Cannot determine if admin access is possible', { 
        path: dirPath, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Test if we currently have admin privileges
   */
  public async hasAdminPrivileges(): Promise<boolean> {
    if (!isMacOS()) {
      return false;
    }

    return new Promise((resolve) => {
      const script = `
        try
          do shell script "whoami" with administrator privileges
          return "true"
        on error
          return "false"
        end try
      `;

      const osascript = spawn('osascript', ['-e', script]);
      let output = '';

      osascript.stdout.on('data', (data) => {
        output += data.toString();
      });

      osascript.on('close', (code) => {
        const hasAdmin = output.trim() === 'true';
        resolve(hasAdmin);
      });

      osascript.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Execute a command with admin privileges
   */
  public async executeWithAdmin(command: string, args: string[] = []): Promise<{ success: boolean; output: string; error?: string }> {
    if (!isMacOS()) {
      return { success: false, output: '', error: 'Admin execution not supported on non-macOS platforms' };
    }

    return new Promise((resolve) => {
      const fullCommand = `${command} ${args.join(' ')}`;
      const script = `
        try
          do shell script "${fullCommand.replace(/"/g, '\\"')}" with administrator privileges
        on error errMsg
          return "ERROR:" & errMsg
        end try
      `;

      const osascript = spawn('osascript', ['-e', script]);
      let output = '';
      let errorOutput = '';

      osascript.stdout.on('data', (data) => {
        output += data.toString();
      });

      osascript.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      osascript.on('close', (code) => {
        const result = output.trim();
        
        if (result.startsWith('ERROR:')) {
          resolve({
            success: false,
            output: '',
            error: result.substring(6)
          });
        } else {
          resolve({
            success: true,
            output: result,
            error: errorOutput.trim() || undefined
          });
        }
      });

      osascript.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }

  /**
   * Clear the admin access cache
   */
  public clearCache(): void {
    this.adminAccessCache.clear();
    log('debug', 'Admin access cache cleared');
  }

  /**
   * Get cache status for debugging
   */
  public getCacheStatus(): { [path: string]: boolean } {
    const status: { [path: string]: boolean } = {};
    this.adminAccessCache.forEach((value, key) => {
      status[key] = value;
    });
    return status;
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getAdminAccessManager(): MacOSAdminAccessManager {
  return MacOSAdminAccessManager.getInstance();
}

/**
 * Quick check for write access with optional admin request
 */
export async function checkAndRequestAccess(
  dirPath: string, 
  requestAdmin: boolean = true,
  options: IAdminRequestOptions = {}
): Promise<IPermissionResult> {
  const manager = getAdminAccessManager();
  const result = await manager.checkWriteAccess(dirPath);
  
  if (!result.hasAccess && requestAdmin && result.canRequestAdmin) {
    const adminGranted = await manager.requestAdminAccess(dirPath, options);
    return {
      ...result,
      adminGranted
    };
  }
  
  return result;
}