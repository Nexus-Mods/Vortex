/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';
import { parseStringPromise } from 'xml2js';

import { GAME_ID, SCRIPT_MERGER_ID, MERGE_INV_MANIFEST } from './common';

import { fs, log, types, util } from 'vortex-api';

function getMergeInventory(api: types.IExtensionApi) {
  // Provided with a pattern, attempts to retrieve element values
  //  from any element keys that match the pattern inside the merge inventory file.
  const state = api.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  const scriptMerger = util.getSafe(discovery, ['tools', SCRIPT_MERGER_ID], undefined);
  if ((scriptMerger === undefined) || (scriptMerger.path === undefined)) {
    return Bluebird.resolve([]);
  }

  return fs.readFileAsync(path.join(path.dirname(scriptMerger.path), MERGE_INV_MANIFEST))
    .then(async xmlData => {
      try {
        const mergeData = await parseStringPromise(xmlData);
        return Promise.resolve(mergeData);
      } catch (err) {
        return Promise.reject(err);
      }
    })
    .catch(err => (err.code === 'ENOENT') // No merge file? - no problem.
      ? Promise.resolve(undefined)
      : Promise.reject(new util.DataInvalid(`Failed to parse ${MERGE_INV_MANIFEST}: ${err}`)));
}

export function getMergedModNames(api: types.IExtensionApi) {
  // This retrieves the name of the resulting merged mod itself.
  //  AKA "mod0000_MergedFiles"
  return getMergeInventory(api)
    .then(async mergeInventory => {
      if (mergeInventory === undefined) {
        return Promise.resolve([]);
      }
      const state = api.getState();
      const discovery = util.getSafe(state,
        ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
      const modsPath = path.join(discovery.path, 'Mods');
      const mergeEntry = mergeInventory?.MergeInventory?.Merge;
      if (mergeEntry === undefined) {
        let inv;
        try {
          inv = JSON.stringify(mergeInventory);
        } catch (err) {
          return Promise.reject(err);
        }
        log('debug', 'failed to retrieve merged mod names', inv);
        return Promise.resolve([]);
      }
      const elements = await mergeEntry.reduce(async (accumP, iter) => {
        const accum = await accumP;
        const mergeModName = iter?.MergedModName?.[0];
        if (mergeModName === undefined) {
          return accum;
        }
        if (!accum.includes(mergeModName)) {
          try {
            await fs.statAsync(path.join(modsPath, mergeModName));
            accum.push(mergeModName);
          } catch (err) {
            log('debug', 'merged mod is missing', mergeModName);
          }
        }
        return accum;
      }, []);
      return Promise.resolve(elements);
    })
    .catch(err => {
      // We failed to parse the merge inventory for whatever reason.
      //  Rather than blocking the user from modding his game we're
      //  we simply return an empty array; but before we do that,
      //  we need to tell him we were unable to parse the merged inventory.
      api.showErrorNotification('Invalid MergeInventory.xml file', err,
        { allowReport: false });
      return Promise.resolve([]);
    });
}

export function getNamesOfMergedMods(api: types.IExtensionApi): Bluebird<string[]> {
  // This retrieves a unique list of mod names included in the merged mod
  return getMergeInventory(api)
    .then(async mergeInventory => {
      if (mergeInventory === undefined) {
        return Promise.resolve([]);
      }
      const state = api.getState();
      const discovery = util.getSafe(state,
        ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
      const modsPath = path.join(discovery.path, 'Mods');
      const modNames = await mergeInventory.MergeInventory.Merge.reduce(async (accumP, iter) => {
        const accum = await accumP;
        const mergedMods = iter?.IncludedMod;
        for (const modName of mergedMods) {
          if (modName === undefined) {
            return accum;
          }
          if (!accum.includes(modName?._)) {
            try {
              await fs.statAsync(path.join(modsPath, modName?._));
              accum.push(modName?._);
            } catch (err) {
              log('debug', 'merged mod is missing', modName?._);
            }
          }
        }
        return accum;
      }, []);
      return Promise.resolve(modNames);
    });
}
