/* eslint-disable */
import React from 'react';
import path from 'path';
import { actions, fs, selectors, types, util } from 'vortex-api';

import { ACTIVITY_ID_IMPORTING_LOADORDER, GAME_ID, LOCKED_PREFIX, UNI_PATCH } from './common';
import InfoComponent from './views/InfoComponent';
import IniStructure from './iniParser';
import { PriorityManager } from './priorityManager';
import { getPersistentLoadOrder } from './migrations';
import { forceRefresh } from './util';
import ItemRenderer from './views/ItemRenderer';
import { IItemRendererProps } from './types';

export interface IBaseProps {
  api: types.IExtensionApi;
  getPriorityManager: () => PriorityManager;
  onToggleModsState: (enable: boolean) => void;
};

class TW3LoadOrder implements types.ILoadOrderGameInfo {
  public gameId: string;
  public toggleableEntries?: boolean | undefined;
  public clearStateOnPurge?: boolean | undefined;
  public usageInstructions?: React.ComponentType<{}>;
  public noCollectionGeneration?: boolean | undefined;
  public customItemRenderer?: React.ComponentType<{ className?: string, item: IItemRendererProps, forwardedRef?: (ref: any) => void }>;

  private mApi: types.IExtensionApi;
  private mPriorityManager: PriorityManager;

  constructor(props: IBaseProps) {
    this.gameId = GAME_ID;
    this.clearStateOnPurge = true;
    this.toggleableEntries = true;
    this.noCollectionGeneration = true;
    this.usageInstructions = () => (<InfoComponent onToggleModsState={props.onToggleModsState} />);
    this.customItemRenderer = (props) => {
      return (<ItemRenderer className={props.className} item={props.item} />)
    };
    this.mApi = props.api;
    this.mPriorityManager = props.getPriorityManager();
    this.deserializeLoadOrder = this.deserializeLoadOrder.bind(this);
    this.serializeLoadOrder = this.serializeLoadOrder.bind(this);
    this.validate = this.validate.bind(this);
  }

  public async serializeLoadOrder(loadOrder: types.LoadOrder): Promise<void> {
    return IniStructure.getInstance(this.mApi, () => this.mPriorityManager)
      .setINIStruct(loadOrder);
  }

  private readableNames = { [UNI_PATCH]: 'Unification/Community Patch' };
  public async deserializeLoadOrder(): Promise<types.LoadOrder> {
    const state = this.mApi.getState();
    const activeProfile = selectors.activeProfile(state);
    if (activeProfile?.id === undefined) {
      return Promise.resolve([]);
    }
    const findName = (entry: { name: string, VK?: string }) => {
      if (this.readableNames?.[entry.name] !== undefined) {
        return this.readableNames[entry.name];
      }

      if (entry.VK === undefined) {
        return entry.name;
      }

      const state = this.mApi.getState();
      const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
      const mod: types.IMod = mods[entry.VK];
      if (mod === undefined) {
        return entry.name;
      }

      return `${util.renderModName(mod)} (${entry.name})`;
    };

    try {
      const unsorted: { [key: string]: any } = await IniStructure.getInstance(this.mApi, () => this.mPriorityManager).readStructure();
      const entries = Object.keys(unsorted).sort((a, b) => unsorted[a].Priority - unsorted[b].Priority).reduce((accum, iter, idx) => {
        const entry = unsorted[iter];
        accum[iter.startsWith(LOCKED_PREFIX) ? 'locked' : 'regular'].push({
          id: iter,
          name: findName({ name: iter, VK: entry.VK }),
          enabled: entry.Enabled === '1',
          modId: entry?.VK ?? iter,
          locked: iter.startsWith(LOCKED_PREFIX),
          data: {
            prefix: iter.startsWith(LOCKED_PREFIX) ? accum.locked.length : entry?.Priority ?? idx + 1,
          }
        })
        return accum;
      }, { locked: [], regular: [] });
      const finalEntries = [].concat(entries.locked, entries.regular);
      return Promise.resolve(finalEntries);
    } catch (err) {
      return;
    }
  }

  public async validate(prev: types.LoadOrder, current: types.LoadOrder): Promise<types.IValidationResult> {
    return Promise.resolve(undefined);
  }
}

export async function importLoadOrder(api: types.IExtensionApi, collectionId: string): Promise<void> {
  // import load order from collection.
  const state = api.getState();
  api.sendNotification({
    type: 'activity',
    id: ACTIVITY_ID_IMPORTING_LOADORDER,
    title: 'Importing Load Order',
    message: 'Parsing collection data',
    allowSuppress: false,
    noDismiss: true,
  });

  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const collectionMod = mods[collectionId];
  if (collectionMod?.installationPath === undefined) {
    api.dismissNotification(ACTIVITY_ID_IMPORTING_LOADORDER);
    api.showErrorNotification('collection mod is missing', collectionId);
    return;
  }

  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  try {
    api.sendNotification({
      type: 'activity',
      id: ACTIVITY_ID_IMPORTING_LOADORDER,
      title: 'Importing Load Order',
      message: 'Ensuring mods are deployed...',
      allowSuppress: false,
      noDismiss: true,
    });
    await util.toPromise(cb => api.events.emit('deploy-mods', cb));
    const fileData = await fs.readFileAsync(path.join(stagingFolder, collectionMod.installationPath, 'collection.json'), { encoding: 'utf8' });
    const collection = JSON.parse(fileData);
    const loadOrder = collection?.loadOrder || {};
    if (Object.keys(loadOrder).length === 0) {
      api.sendNotification({
        type: 'success',
        message: 'Collection does not include load order to import',
        displayMS: 3000,
      });
      return;
    }

    const converted = getPersistentLoadOrder(api, loadOrder);
    api.sendNotification({
      type: 'activity',
      id: ACTIVITY_ID_IMPORTING_LOADORDER,
      title: 'Importing Load Order',
      message: 'Writing Load Order...',
      allowSuppress: false,
      noDismiss: true,
    });
    await IniStructure.getInstance().setINIStruct(converted)
      .then(() => forceRefresh(api));
    api.sendNotification({
      type: 'success',
      message: 'Collection load order has been imported',
      displayMS: 3000,
    });
    return;
  } catch (err) {
    api.showErrorNotification('Failed to import load order', err);
    return;
  } finally {
    api.dismissNotification(ACTIVITY_ID_IMPORTING_LOADORDER);
  }
}

export default TW3LoadOrder;