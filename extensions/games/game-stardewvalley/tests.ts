import { types, selectors } from 'vortex-api';

import DependencyManager from './DependencyManager';

import { coerce, gte } from 'semver';

import { downloadSMAPI, findSMAPIMod } from './SMAPI';

import { GAME_ID } from './common';

export async function testSMAPIOutdated(api: types.IExtensionApi,
                                        depManager: DependencyManager)
                                        : Promise<types.ITestResult> {
  const state = api.getState();
  const activeGameId = selectors.activeGameId(state);
  if (activeGameId !== GAME_ID) {
    return Promise.resolve(undefined);
  }

  let currentSMAPIVersion = findSMAPIMod(api)?.attributes?.version;
  if (currentSMAPIVersion === undefined) {
    // SMAPI isn't installed or enabled.
    return Promise.resolve(undefined);
  }

  const isSmapiOutdated = async () => {
    currentSMAPIVersion = findSMAPIMod(api)?.attributes?.version;
    const enabledManifests = await depManager.getManifests();
    const incompatibleModIds: string[] = [];
    for (const [id, manifests] of Object.entries(enabledManifests)) {
      const incompatible = manifests.filter((iter) => {
        if (iter.MinimumApiVersion !== undefined) {
          return !gte(currentSMAPIVersion, coerce(iter.MinimumApiVersion ?? '0.0.0'));
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
    : Promise.resolve(undefined);
}