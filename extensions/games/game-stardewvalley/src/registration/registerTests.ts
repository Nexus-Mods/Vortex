/**
 * Registers Stardew Valley extension diagnostics with Vortex.
 */
import Bluebird from 'bluebird';

import type { types } from 'vortex-api';

import type DependencyManager from '../DependencyManager';
import { testSMAPIOutdated } from '../tests';

/**
 * Registers diagnostic tests used by the Stardew Valley extension.
 */
export function registerTests(context: types.IExtensionContext,
                              dependencyManager: DependencyManager) {
  context.registerTest('sdv-incompatible-mods', 'gamemode-activated',
    () => Bluebird.resolve(testSMAPIOutdated(context.api, dependencyManager)));
}
