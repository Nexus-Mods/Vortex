/**
 * Registers Stardew-specific settings, actions, and table renderers in the UI.
 */
import React from 'react';

import { selectors } from 'vortex-api';
import type { types } from 'vortex-api';

import { setMergeConfigs } from '../state/actions';
import CompatibilityIcon from '../CompatibilityIcon';
import { GAME_ID } from '../common';
import { onRevertFiles } from '../configMod';
import Settings from '../Settings';
import { onShowSMAPILog } from '../ui/smapiLog';

/**
 * Registers UI-facing extension integrations.
 *
 * This includes:
 * - Stardew-specific settings panel
 * - SMAPI log quick action in the mods view
 * - compatibility table column renderer
 */
export function registerUi(context: types.IExtensionContext) {
  context.registerSettings('Mods', Settings, () => ({
    onMergeConfigToggle: async (profileId: string, enabled: boolean) => {
      if (!enabled) {
        await onRevertFiles(context.api, profileId);
        context.api.sendNotification?.({
          type: 'info',
          message: 'Mod configs returned to their respective mods',
          displayMS: 5000,
        });
      }
      context.api.store?.dispatch(setMergeConfigs(profileId, enabled));
      return Promise.resolve();
    },
  }), () => selectors.activeGameId(context.api.getState()) === GAME_ID, 150);

  context.registerAction('mod-icons', 999, 'changelog', {}, 'SMAPI Log',
    () => {
      onShowSMAPILog(context.api);
    },
    () => {
      const state = context.api.getState();
      const gameMode = selectors.activeGameId(state);
      return (gameMode === GAME_ID);
    });

  context.registerTableAttribute('mods', {
    id: 'sdv-compatibility',
    position: 100,
    condition: () => selectors.activeGameId(context.api.getState()) === GAME_ID,
    placement: 'table',
    calc: (mod: types.IMod) => mod.attributes?.compatibilityStatus,
    customRenderer: (mod: types.IMod, detailCell: boolean, t: types.TFunction) => {
      return React.createElement(CompatibilityIcon,
        { t, mod, detailCell }, []);
    },
    name: 'Compatibility',
    isDefaultVisible: true,
    edit: {},
  });
}
