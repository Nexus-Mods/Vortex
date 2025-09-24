/**
 * Native macOS Spotlight Integration for Vortex
 * 
 * This module provides native macOS Spotlight integration using osascript
 * to replace the problematic electron-spotlight dependency.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';
import { isMacOS } from './platform';

const execFile = promisify(require('child_process').execFile);

export interface SpotlightItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  path?: string;
  keywords?: string[];
}

/**
 * Native macOS Spotlight integration class
 */
class NativeSpotlight {
  private indexedItems: Map<string, SpotlightItem> = new Map();
  private metadataDir: string;

  constructor() {
    // Create a directory for storing metadata files that Spotlight can index
    this.metadataDir = path.join(process.env.HOME || '', '.vortex', 'spotlight');
  }

  /**
   * Initialize the native Spotlight integration
   */
  async initialize(): Promise<void> {
    if (!isMacOS()) {
      return;
    }

    try {
      // Ensure metadata directory exists
      await fs.ensureDir(this.metadataDir);
      console.log('Native Spotlight integration initialized');
    } catch (err) {
      console.warn('Failed to initialize native Spotlight integration:', err);
    }
  }

  /**
   * Add items to Spotlight index using native macOS metadata
   */
  async addItems(items: SpotlightItem[]): Promise<void> {
    if (!isMacOS()) {
      return;
    }

    try {
      for (const item of items) {
        await this.addSingleItem(item);
        this.indexedItems.set(item.id, item);
      }
      
      // Trigger Spotlight reindex of our metadata directory
      await this.triggerSpotlightReindex();
      
      console.log(`Added ${items.length} items to native Spotlight index`);
    } catch (err) {
      console.warn('Failed to add items to native Spotlight index:', err);
    }
  }

  /**
   * Remove items from Spotlight index
   */
  async removeItems(ids: string[]): Promise<void> {
    if (!isMacOS()) {
      return;
    }

    try {
      for (const id of ids) {
        await this.removeSingleItem(id);
        this.indexedItems.delete(id);
      }
      
      // Trigger Spotlight reindex
      await this.triggerSpotlightReindex();
      
      console.log(`Removed ${ids.length} items from native Spotlight index`);
    } catch (err) {
      console.warn('Failed to remove items from native Spotlight index:', err);
    }
  }

  /**
   * Remove all items from Spotlight index
   */
  async removeAllItems(): Promise<void> {
    if (!isMacOS()) {
      return;
    }

    try {
      // Remove all metadata files
      await fs.emptyDir(this.metadataDir);
      this.indexedItems.clear();
      
      // Trigger Spotlight reindex
      await this.triggerSpotlightReindex();
      
      console.log('Removed all items from native Spotlight index');
    } catch (err) {
      console.warn('Failed to remove all items from native Spotlight index:', err);
    }
  }

  /**
   * Add a single item to the Spotlight index
   */
  private async addSingleItem(item: SpotlightItem): Promise<void> {
    const filename = `${item.id}.vortex`;
    const filepath = path.join(this.metadataDir, filename);
    
    // Create a text file with searchable content
    const content = [
      `Vortex: ${item.title}`,
      item.subtitle || '',
      ...(item.keywords || []),
      'Vortex Mod Manager',
      'Game Mods',
      'Nexus Mods'
    ].filter(Boolean).join('\n');

    await fs.writeFile(filepath, content, 'utf8');

    // Set extended attributes for better Spotlight integration
    try {
      await this.setExtendedAttributes(filepath, item);
    } catch (err) {
      // Extended attributes are optional, continue if they fail
      console.warn('Failed to set extended attributes:', err);
    }
  }

  /**
   * Remove a single item from the Spotlight index
   */
  private async removeSingleItem(id: string): Promise<void> {
    const filename = `${id}.vortex`;
    const filepath = path.join(this.metadataDir, filename);
    
    try {
      await fs.remove(filepath);
    } catch (err) {
      // File might not exist, which is fine
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Set extended attributes for better Spotlight integration
   */
  private async setExtendedAttributes(filepath: string, item: SpotlightItem): Promise<void> {
    try {
      // Set Spotlight comment
      await execFile('xattr', ['-w', 'com.apple.metadata:kMDItemFinderComment', item.title, filepath]);
      
      // Set keywords if available
      if (item.keywords && item.keywords.length > 0) {
        const keywords = item.keywords.join(',');
        await execFile('xattr', ['-w', 'com.apple.metadata:kMDItemKeywords', keywords, filepath]);
      }
      
      // Set content type
      await execFile('xattr', ['-w', 'com.apple.metadata:kMDItemContentType', 'public.text', filepath]);
      
    } catch (err) {
      // Extended attributes are optional
      console.warn('Failed to set extended attributes for', filepath, ':', err);
    }
  }

  /**
   * Trigger Spotlight to reindex our metadata directory
   */
  private async triggerSpotlightReindex(): Promise<void> {
    try {
      // Use mdimport to force Spotlight to reindex our directory
      await execFile('mdimport', ['-r', this.metadataDir]);
    } catch (err) {
      // Reindexing is optional, continue if it fails
      console.warn('Failed to trigger Spotlight reindex:', err);
    }
  }

  /**
   * Get all indexed items
   */
  getIndexedItems(): SpotlightItem[] {
    return Array.from(this.indexedItems.values());
  }
}

// Create a singleton instance
const nativeSpotlight = new NativeSpotlight();

// Export the interface functions
export async function initializeSpotlight(): Promise<void> {
  return nativeSpotlight.initialize();
}

export async function addSpotlightItems(items: SpotlightItem[]): Promise<void> {
  return nativeSpotlight.addItems(items);
}

export async function removeSpotlightItems(ids: string[]): Promise<void> {
  return nativeSpotlight.removeItems(ids);
}

export async function removeAllSpotlightItems(): Promise<void> {
  return nativeSpotlight.removeAllItems();
}

export function getIndexedSpotlightItems(): SpotlightItem[] {
  return nativeSpotlight.getIndexedItems();
}