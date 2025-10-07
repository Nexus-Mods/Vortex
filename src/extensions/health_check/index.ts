import Bluebird from 'bluebird';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { HealthCheckRegistry } from './HealthCheckRegistry';
import { LegacyTestAdapter } from './LegacyTestAdapter';
import { activeGameId } from '../profile_management/selectors';
import HealthCheckView from './views/HealthCheckView';
import { 
  HealthCheckTrigger,
  HealthCheckCategory,
  IHealthCheckResult,
  HealthCheckSeverity 
} from '../../types/IHealthCheck';

let gHealthCheckRegistry: HealthCheckRegistry | undefined;
let gLegacyAdapter: LegacyTestAdapter | undefined;

function init(context: IExtensionContext): boolean {
  const api = context.api;
  
  try {
    gHealthCheckRegistry = new HealthCheckRegistry(api);
    gLegacyAdapter = new LegacyTestAdapter(gHealthCheckRegistry, api);
    context.registerMainPage('health', 'Health Check', HealthCheckView, {
      hotkey: 'H',
      group: 'per-game',
      visible: () => {
        const currentGameId: string = activeGameId(context.api.getState());
        return currentGameId != null;
      },
      priority: 60,
      props: () => ({
        registry: gHealthCheckRegistry,
      }),
    });

    setupAutomaticTriggers(api);

    log('info', 'Health check system initialized successfully');
    return true;
  } catch (error) {
    const err = error as Error;
    log('error', 'Failed to initialize health check system', { error: err.message });
    return false;
  }
}



/**
 * Setup automatic triggers for health checks
 */
function setupAutomaticTriggers(api: IExtensionApi): void {
  if (!gHealthCheckRegistry) {
    log('warn', 'Cannot setup automatic triggers: health check registry not initialized');
    return;
  }

  if (!api || !api.events) {
    log('warn', 'Cannot setup automatic triggers: API or events not available');
    return;
  }

  const registry = gHealthCheckRegistry;

  try {
    // Check if events object has the required methods
    if (typeof api.events.on !== 'function') {
      log('warn', 'Cannot setup automatic triggers: api.events.on is not a function');
      return;
    }

    // Startup trigger - run once when Vortex starts
    api.events.on('startup', () => {
      log('debug', 'Triggering startup health checks');
      triggerHealthChecks(HealthCheckTrigger.Startup);
    });

    // Game changed trigger
    api.events.on('gamemode-activated', (gameMode: string) => {
      log('debug', 'Triggering game change health checks', { gameMode });
      triggerHealthChecks(HealthCheckTrigger.GameChanged);
    });

    // Profile changed trigger
    api.events.on('profile-did-change', (profileId: string) => {
      log('debug', 'Triggering profile change health checks', { profileId });
      triggerHealthChecks(HealthCheckTrigger.ProfileChanged);
    });

    // Settings changed trigger
    api.events.on('settings-changed', (path: string[]) => {
      log('debug', 'Triggering settings change health checks', { path });
      triggerHealthChecks(HealthCheckTrigger.SettingsChanged);
    });

    // Mods changed triggers
    api.events.on('mod-installed', () => {
      log('debug', 'Triggering mod change health checks (installed)');
      triggerHealthChecks(HealthCheckTrigger.ModsChanged);
    });

    api.events.on('mod-enabled', () => {
      log('debug', 'Triggering mod change health checks (enabled)');
      triggerHealthChecks(HealthCheckTrigger.ModsChanged);
    });

    api.events.on('mod-disabled', () => {
      log('debug', 'Triggering mod change health checks (disabled)');
      triggerHealthChecks(HealthCheckTrigger.ModsChanged);
    });

    // Plugin changes trigger
    api.events.on('plugins-changed', () => {
      log('debug', 'Triggering plugin change health checks');
      triggerHealthChecks(HealthCheckTrigger.PluginsChanged);
    });

    // LOOT update trigger (if available)
    api.events.on('loot-info-updated', () => {
      log('debug', 'Triggering LOOT update health checks');
      triggerHealthChecks(HealthCheckTrigger.LootUpdated);
    });

    log('debug', 'Automatic triggers setup complete');
  } catch (error) {
    const err = error as Error;
    log('error', 'Failed to setup automatic triggers', { error: err.message });
  }
}

/**
 * Trigger health checks for a specific trigger type
 */
function triggerHealthChecks(trigger: HealthCheckTrigger): void {
  if (!gHealthCheckRegistry) {
    log('warn', 'Health check registry not initialized');
    return;
  }

  // Run checks asynchronously to avoid blocking
  Bluebird.resolve(null)
    .then(() => Bluebird.resolve(gHealthCheckRegistry!.executeByTrigger(trigger)))
    .then((results) => {
      const summary = gHealthCheckRegistry!.getSummary();
      log('debug', 'Health checks completed', {
        trigger,
        totalChecks: results.length,
        passed: summary.lastResults.passed,
        warnings: summary.lastResults.warning,
        errors: summary.lastResults.error,
        failed: summary.lastResults.failed
      });

      // Emit event for UI updates with proper error handling
      try {
        const api = gHealthCheckRegistry!.getApi();
        if (api && api.events && typeof api.events.emit === 'function') {
          api.events.emit('health-check-results', {
            trigger,
            results,
            summary
          });
        }
      } catch (error) {
        const err = error as Error;
        log('warn', 'Failed to emit health check results event', { error: err.message });
      }
    })
    .catch((error) => {
      const err = error as Error;
      log('error', 'Failed to run health checks', { trigger, error: err.message });
    });
}

/**
 * Get the health check registry instance
 */
export function getHealthCheckRegistry(): HealthCheckRegistry | undefined {
  return gHealthCheckRegistry;
}

/**
 * Get the legacy adapter instance
 */
export function getLegacyAdapter(): LegacyTestAdapter | undefined {
  return gLegacyAdapter;
}

/**
 * Manually trigger health checks (for testing or manual execution)
 */
export function manualTrigger(): Bluebird<IHealthCheckResult[]> {
  if (!gHealthCheckRegistry) {
    return Bluebird.reject(new Error('Health check registry not initialized'));
  }
  
  return Bluebird.resolve(gHealthCheckRegistry.executeByTrigger(HealthCheckTrigger.Manual));
}

/**
 * Export the extension initialization function
 */
export default init;