/**
 * Browse Nexus Extension
 * Provides browsing functionality for Nexus Mods collections and mods
 */

import { activeGameId } from '../../util/selectors';
import { IExtensionContext } from '../../types/IExtensionContext';
import BrowseNexusPage from './views/BrowseNexusPage';

function init(context: IExtensionContext): boolean {
  // Register the Browse page
  context.registerMainPage('search', 'Browse Nexus Mods', BrowseNexusPage, {
    hotkey: 'B',
    group: 'per-game',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
    }),
    priority: 0, // Force top of game section
  });

  return true;
}

export default init;
