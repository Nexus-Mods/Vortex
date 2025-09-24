/**
 * macOS Spotlight Integration for Vortex
 * 
 * This module provides integration with macOS Spotlight search,
 * allowing Vortex to index content and provide quick actions.
 * 
 * Now uses native macOS integration instead of electron-spotlight.
 */

import { isMacOS } from './platform';
import { 
  initializeSpotlight as initNativeSpotlight,
  addSpotlightItems as addNativeSpotlightItems,
  removeSpotlightItems as removeNativeSpotlightItems,
  removeAllSpotlightItems as removeAllNativeSpotlightItems,
  SpotlightItem
} from './nativeSpotlight';

/**
 * Initialize Spotlight integration
 */
export async function initializeSpotlight(): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    await initNativeSpotlight();
    console.log('Native Spotlight integration initialized');
  } catch (err) {
    console.warn('Failed to initialize native Spotlight integration:', err);
  }
}

/**
 * Add items to Spotlight index
 * @param items Array of items to index in Spotlight
 */
export async function addSpotlightItems(items: Array<{id: string, title: string, subtitle?: string, icon?: string}>): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    // Convert to SpotlightItem format
    const spotlightItems: SpotlightItem[] = items.map(item => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
      keywords: ['Vortex', 'Mod Manager', 'Game Mods']
    }));

    await addNativeSpotlightItems(spotlightItems);
    console.log(`Added ${items.length} items to native Spotlight index`);
  } catch (err) {
    console.warn('Failed to add items to native Spotlight index:', err);
  }
}

/**
 * Remove items from Spotlight index
 * @param ids Array of item IDs to remove from Spotlight
 */
export async function removeSpotlightItems(ids: string[]): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    await removeNativeSpotlightItems(ids);
    console.log(`Removed ${ids.length} items from native Spotlight index`);
  } catch (err) {
    console.warn('Failed to remove items from native Spotlight index:', err);
  }
}

/**
 * Remove all items from Spotlight index
 */
export async function removeAllSpotlightItems(): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    await removeAllNativeSpotlightItems();
    console.log('Removed all items from native Spotlight index');
  } catch (err) {
    console.warn('Failed to remove all items from native Spotlight index:', err);
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