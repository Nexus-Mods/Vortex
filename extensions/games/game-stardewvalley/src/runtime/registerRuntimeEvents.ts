/**
 * Registers runtime event handlers used by the Stardew Valley extension.
 */
import Bluebird from 'bluebird';
import type { IQuery } from 'modmeta-db';
import path from 'path';

import { actions, log, selectors, util } from 'vortex-api';
import type { types } from 'vortex-api';

import { updateConflictInfo } from '../compatibility/updateConflictInfo';
import { GAME_ID } from '../common';
import { errorMessage } from '../helpers';
import { onAddedFiles, onWillEnableMods } from '../configMod';
import { findSMAPIMod, SMAPIProxy } from '../smapi';

/**
 * Registers long-lived runtime handlers that should run once the extension is
 * fully initialised.
 *
 * This owns:
 * - SMAPI metadata server registration
 * - deployment/purge hooks
 * - file ingestion hooks
 * - compatibility refresh hooks
 */
export function registerRuntimeEvents(context: types.IExtensionContext) {
  context.once(() => {
    const store = context.api.store;
    if (store === undefined) {
      log('error', 'stardewvalley failed to initialize runtime: redux store unavailable');
      return;
    }

    const proxy = new SMAPIProxy(context.api);
    context.api.setStylesheet('sdv', path.join(__dirname, 'ui', 'sdvstyle.scss'));

    context.api.addMetaServer('smapi.io', {
      url: '',
      loopbackCB: (query: IQuery) => {
        return Bluebird.resolve(proxy.find(query))
          .catch(err => {
            log('error', 'failed to look up smapi meta info', errorMessage(err));
            return Bluebird.resolve([]);
          });
      },
      cacheDurationSec: 86400,
      priority: 25,
    });

    context.api.onAsync('added-files', (profileId: string, files: any[]) =>
      onAddedFiles(context.api, profileId, files) as any);

    context.api.onAsync('will-enable-mods',
      (profileId: string, modIds: string[], enabled: boolean, options: any) =>
        onWillEnableMods(context.api, profileId, modIds, enabled, options) as any);

    context.api.onAsync('did-deploy', async profileId => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }

      const smapiMod = findSMAPIMod(context.api);
      const primaryTool = util.getSafe(state, ['settings', 'interface', 'primaryTool', GAME_ID], undefined);
      if (smapiMod && primaryTool === undefined) {
        store.dispatch(actions.setPrimaryTool(GAME_ID, 'smapi'));
      }

      return Promise.resolve();
    });

    context.api.onAsync('did-purge', async profileId => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }

      const smapiMod = findSMAPIMod(context.api);
      const primaryTool = util.getSafe(state, ['settings', 'interface', 'primaryTool', GAME_ID], undefined);
      if (smapiMod && primaryTool === 'smapi') {
        store.dispatch(actions.setPrimaryTool(GAME_ID, undefined as any));
      }

      return Promise.resolve();
    });

    context.api.events.on('did-install-mod', (gameId: string, archiveId: string, modId: string) => {
      if (gameId !== GAME_ID) {
        return;
      }
      updateConflictInfo(context.api, proxy, gameId, modId)
        .then(() => log('debug', 'added compatibility info', { modId }))
        .catch(err => log('error', 'failed to add compatibility info', { modId, error: errorMessage(err) }));
    });

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      if (gameMode !== GAME_ID) {
        return;
      }

      const state = context.api.getState();
      log('debug', 'updating SDV compatibility info');
      Promise.all(Object.keys(state.persistent.mods[gameMode] ?? {}).map(modId =>
        updateConflictInfo(context.api, proxy, gameMode, modId)))
        .then(() => {
          log('debug', 'done updating compatibility info');
        })
        .catch(err => {
          log('error', 'failed to update conflict info', errorMessage(err));
        });
    });

  });
}
