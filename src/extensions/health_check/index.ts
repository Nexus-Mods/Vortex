/**
 * Health check extension 
 * Provides health check functionality for mods
 */

import { activeGameId } from '../../util/selectors';
import { IExtensionContext } from '../../types/IExtensionContext';
import HealthCheckPage from './views/HealthCheckPage';

function init(context: IExtensionContext): boolean {
  
// Only register this page in development mode
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!isDevelopment) {
    return false; // Don't initialize in production
  }

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
