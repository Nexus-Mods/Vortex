/**
 * Health check extension 
 * Provides health check functionality for mods
 */

import { activeGameId } from '../../util/selectors';
import { IExtensionContext } from '../../types/IExtensionContext';
import HealthCheckPage from './views/HealthCheckPage';

function init(context: IExtensionContext): boolean {

  // Register the Health Check page
  context.registerMainPage('health', 'Health Check', HealthCheckPage, {
    hotkey: 'H',
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
