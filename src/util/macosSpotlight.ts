/**
 * macOS Spotlight Integration for Vortex
 * 
 * This module provides integration with macOS Spotlight search,
 * allowing Vortex to index content and provide quick actions.
 */

import { isMacOS } from './platform';
import { app } from 'electron';

// We'll use a dynamic import for electron-spotlight since it's macOS-only
let spotlightModule: any = null;

// Try to import type definitions if available
let hasSpotlightTypes = false;
try {
  require('electron-spotlight');
  hasSpotlightTypes = true;
} catch (err) {
  // No type definitions available
}

/**
 * Initialize Spotlight integration
 */
export async function initializeSpotlight(): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    // Dynamically import the electron-spotlight module
    // Use a more robust approach for TypeScript compatibility
    try {
      // Use a dynamic require with type assertion to avoid TypeScript errors
      const modulePath = 'electron-spotlight';
      spotlightModule = require(modulePath);
    } catch (err) {
      console.warn('Failed to import electron-spotlight:', err);
    }
    
    // Set up any initial Spotlight integration
    console.log('Spotlight integration initialized');
  } catch (err) {
    console.warn('Failed to initialize Spotlight integration:', err);
  }
}

/**
 * Add items to Spotlight index
 * @param items Array of items to index in Spotlight
 */
export async function addSpotlightItems(items: Array<{id: string, title: string, icon?: string}>): Promise<void> {
  if (!isMacOS() || !spotlightModule) {
    return;
  }

  try {
    await spotlightModule.addItems(items);
    console.log(`Added ${items.length} items to Spotlight index`);
  } catch (err) {
    console.warn('Failed to add items to Spotlight index:', err);
  }
}

/**
 * Remove items from Spotlight index
 * @param ids Array of item IDs to remove from Spotlight
 */
export async function removeSpotlightItems(ids: string[]): Promise<void> {
  if (!isMacOS() || !spotlightModule) {
    return;
  }

  try {
    await spotlightModule.removeItems(ids);
    console.log(`Removed ${ids.length} items from Spotlight index`);
  } catch (err) {
    console.warn('Failed to remove items from Spotlight index:', err);
  }
}

/**
 * Remove all items from Spotlight index
 */
export async function removeAllSpotlightItems(): Promise<void> {
  if (!isMacOS() || !spotlightModule) {
    return;
  }

  try {
    await spotlightModule.removeAllItems();
    console.log('Removed all items from Spotlight index');
  } catch (err) {
    console.warn('Failed to remove all items from Spotlight index:', err);
  }
}

/**
 * Index common Vortex actions for Spotlight quick actions
 */
export async function indexVortexActions(): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  const actions = [
    {
      id: 'vortex-refresh',
      title: 'Refresh Vortex',
      icon: '🔄'
    },
    {
      id: 'vortex-settings',
      title: 'Open Settings',
      icon: '⚙️'
    },
    {
      id: 'vortex-profiles',
      title: 'Manage Profiles',
      icon: '👥'
    },
    {
      id: 'vortex-mods',
      title: 'View Mods',
      icon: '📦'
    },
    {
      id: 'vortex-dashboard',
      title: 'Open Dashboard',
      icon: '📊'
    },
    {
      id: 'vortex-check-updates',
      title: 'Check for Updates',
      icon: '⬆️'
    }
  ];

  await addSpotlightItems(actions);
}

/**
 * Index recently used mods for Spotlight search
 * @param mods Array of recently used mods
 */
export async function indexRecentMods(mods: Array<{id: string, name: string, gameId: string}>): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  const items = mods.map(mod => ({
    id: `mod-${mod.id}`,
    title: mod.name,
    subtitle: `Mod for ${mod.gameId}`,
    icon: '📦'
  }));

  await addSpotlightItems(items);
}

/**
 * Index game entries for Spotlight search
 * @param games Array of game entries
 */
export async function indexGames(games: Array<{id: string, name: string}>): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  const items = games.map(game => ({
    id: `game-${game.id}`,
    title: game.name,
    icon: '🎮'
  }));

  await addSpotlightItems(items);
}