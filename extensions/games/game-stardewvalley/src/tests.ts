/**
 * Defines Stardew Valley diagnostic tests shown in Vortex health checks.
 */
import type { types} from 'vortex-api';

import { coerce as semverCoerce, gte } from 'semver';
import { selectors } from 'vortex-api';

import type ModManifestCache from './manifests/ModManifestCache';

import { GAME_ID } from './common';
import { downloadSMAPI, findSMAPIMod } from './SMAPI';

/** Verifies whether active mods require a newer SMAPI version. */
export async function testSMAPIOutdated(api: types.IExtensionApi,
                                        modManifestCache: ModManifestCache)
                                        : Promise<types.ITestResult> {
  const state = api.getState();
  const activeGameId = selectors.activeGameId(state);
  if (activeGameId !== GAME_ID) {
    return Promise.resolve(undefined as any);
  }

  let currentSMAPIVersion = findSMAPIMod(api)?.attributes?.version;
  if (currentSMAPIVersion === undefined) {
    // SMAPI isn't installed or enabled.
    return Promise.resolve(undefined as any);
  }

  const isSmapiOutdated = async () => {
    currentSMAPIVersion = findSMAPIMod(api)?.attributes?.version;
    if (currentSMAPIVersion === undefined) {
      return false;
    }
    const installedVersion = currentSMAPIVersion;
    const enabledManifests = await modManifestCache.getManifests();
    const incompatibleModIds: string[] = [];
    for (const [id, manifests] of Object.entries(enabledManifests)) {
      const incompatible = manifests.filter((iter) => {
        if (iter.MinimumApiVersion !== undefined) {
          const minApiVersion = semverCoerce(iter.MinimumApiVersion ?? '0.0.0');
          if (minApiVersion === null) {
            return false;
          }
          return !gte(installedVersion, minApiVersion);
        }
        return false;
      });
      if (incompatible.length > 0) {
        incompatibleModIds.push(id);
      }
    }
    return Promise.resolve((incompatibleModIds.length > 0));
  }

  const outdated = await isSmapiOutdated();
  const t = api.translate;
  return outdated
    ? Promise.resolve({
      description: {
        short: t('SMAPI update required'),
        long: t('Some Stardew Valley mods require a newer version of SMAPI to function correctly, '
              + 'you should check for SMAPI updates in the mods page.'),
      },
      automaticFix: () => downloadSMAPI(api, true),
      onRecheck: () => isSmapiOutdated(),
      severity: 'warning' as types.ProblemSeverity,
    }) as any
    : Promise.resolve(undefined as any);
}
