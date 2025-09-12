/**
 * Platform-specific text utilities for consistent cross-platform behavior
 */

import { getCurrentPlatform, Platform } from './platform';
import { TFunction } from 'i18next';

/**
 * Interface for platform-specific text options
 */
export interface IPlatformTextOptions {
  win32?: string;
  darwin?: string;
  linux?: string;
  default?: string;
}

/**
 * Get platform-specific text with automatic platform detection
 * @param text The text to process for platform-specific variations
 * @param platform Optional platform to use instead of auto-detection
 * @returns Platform-appropriate text
 */
export function getPlatformText(text: string, platform?: Platform): string {
  const currentPlatform = platform || getCurrentPlatform();
  
  // Replace Ctrl with Cmd on macOS
  if (currentPlatform === 'darwin') {
    return text.replace(/Ctrl/g, 'Cmd');
  }
  
  return text;
}

/**
 * Get platform-specific text from structured options
 * @param options Structured options for different platforms
 * @param t Translation function
 * @returns Platform-appropriate text
 */
export function getStructuredPlatformText(options: IPlatformTextOptions, t: TFunction): string {
  const platform = getCurrentPlatform();
  
  // Check for platform-specific text
  if (options[platform]) {
    return options[platform];
  }
  
  // Fall back to default
  if (options.default) {
    return options.default;
  }
  
  // Fall back to simple replacements
  if (platform === 'darwin' && options.win32) {
    return options.win32.replace(/Ctrl/g, 'Cmd');
  }
  
  // Return any available text
  return options.win32 || options.linux || options.darwin || '';
}

/**
 * Process text with platform-specific keyboard shortcut replacements
 * @param text The text to process
 * @param t Translation function
 * @returns Platform-appropriate text with proper keyboard shortcuts
 */
export function processPlatformText(text: string, t: TFunction): string {
  const platform = getCurrentPlatform();
  
  // For macOS, replace Ctrl with Cmd
  if (platform === 'darwin') {
    return text.replace(/Ctrl/g, 'Cmd');
  }
  
  return text;
}