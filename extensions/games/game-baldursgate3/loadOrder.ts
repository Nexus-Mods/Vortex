/* eslint-disable */
import { actions, fs, log, selectors, types, util } from 'vortex-api';
import path from 'path';
import * as semver from 'semver';
import Bluebird from 'bluebird';

import { GAME_ID, LO_FILE_NAME, NOTIF_IMPORT_ACTIVITY } from './common';
import { BG3Pak, IModNode, IModSettings, IProps, IRootNode } from './types';
import { Builder, parseStringPromise, RenderOptions } from 'xml2js';
import { LockedState } from 'vortex-api/lib/extensions/file_based_loadorder/types/types';
import { IOpenOptions, ISaveOptions } from 'vortex-api/lib/types/IExtensionContext';

import { DivineExecMissing } from './divineWrapper';
import { findNode, forceRefresh, getActivePlayerProfile, getDefaultModSettingsFormat, getPlayerProfiles, logDebug, modsPath, profilesPath } from './util';

import PakInfoCache, { ICacheEntry } from './cache';

export async function serialize(context: types.IExtensionContext,
                                loadOrder: types.LoadOrder,
                                profileId?: string): Promise<void> {
  const props: IProps = genProps(context);
  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('invalid props'));
  }
  
  const state = context.api.getState();

  // Make sure the LO file is created and ready to be written to.
  const loFilePath = await ensureLOFile(context, profileId, props);
  //const filteredLO = loadOrder.filter(lo => (!INVALID_LO_MOD_TYPES.includes(props.mods?.[lo?.modId]?.type)));

  logDebug('serialize loadOrder=', loadOrder);

  // Write the prefixed LO to file.
  await fs.removeAsync(loFilePath).catch({ code: 'ENOENT' }, () => Promise.resolve());
  await fs.writeFileAsync(loFilePath, JSON.stringify(loadOrder), { encoding: 'utf8' });

  // check the state for if we are keeping the game one in sync
  // if we are writing vortex's load order, then we will also write the games one

  const autoExportToGame:boolean = state.settings['baldursgate3'].autoExportLoadOrder ?? false;

  logDebug('serialize autoExportToGame=', autoExportToGame);

  if(autoExportToGame) 
    await exportToGame(context.api);

  return Promise.resolve();
}

export async function deserialize(context: types.IExtensionContext): Promise<types.LoadOrder> {
  
  // genProps is a small utility function which returns often re-used objects
  //  such as the current list of installed Mods, Vortex's application state,
  //  the currently active profile, etc.
  const props: IProps = genProps(context);
  if (props?.profile?.gameId !== GAME_ID) {
    // Why are we deserializing when the profile is invalid or belongs to another game ?
    return [];
  }
  
  const paks = await readPAKs(context.api);

  // create if necessary, but load the load order from file    
  const loFilePath = await ensureLOFile(context);
  const fileData = await fs.readFileAsync(loFilePath, { encoding: 'utf8' });

  let loadOrder: types.ILoadOrderEntry[] = [];

  try {
    
    try {
      loadOrder = JSON.parse(fileData);
    } catch (err) {
      log('error', 'Corrupt load order file', err);
      await new Promise<void>((resolve, reject) => {
        props.api.showDialog('error', 'Corrupt load order file', {
          bbcode: props.api.translate('The load order file is in a corrupt state. You can try to fix it yourself '
                                    + 'or Vortex can regenerate the file for you, but that may result in loss of data ' +
                                      '(Will only affect load order items you added manually, if any).')
        }, [
          { label: 'Cancel', action: () => reject(err) },
          { label: 'Regenerate File', action: async () => {
              await fs.removeAsync(loFilePath).catch({ code: 'ENOENT' }, () => Promise.resolve());
              loadOrder = [];
              return resolve();
            }
          }
        ])
      })
    }

    
    logDebug('deserialize loadOrder=', loadOrder);

    // filter out any pak files that no longer exist
    const filteredLoadOrder: types.LoadOrder = loadOrder.filter(entry => paks.find(pak => pak.fileName === entry.id));

    logDebug('deserialize filteredLoadOrder=', filteredLoadOrder);

    // filter out pak files that don't have a corresponding mod (which means Vortex didn't install it/isn't aware of it)
    //const paksWithMods:BG3Pak[] = paks.filter(pak => pak.mod !== undefined);

      // go through each pak file in the Mods folder...
    const processedPaks = paks.reduce((acc, curr) => {            
      acc.valid.push(curr);
      return acc;
    }, { valid: [], invalid: [] });

    logDebug('deserialize processedPaks=', processedPaks);

    // get any pak files that aren't in the filteredLoadOrder
    const addedMods: BG3Pak[] = processedPaks.valid.filter(pak => filteredLoadOrder.find(entry => entry.id === pak.fileName) === undefined);

    logDebug('deserialize addedMods=', addedMods);
    
    // Check if the user added any new mods.
    //const diff = enabledModIds.filter(id => (!INVALID_LO_MOD_TYPES.includes(mods[id]?.type))
    //  && (filteredData.find(loEntry => loEntry.id === id) === undefined));

    logDebug('deserialize paks=', paks);


    // Add any newly added mods to the bottom of the loadOrder.
    addedMods.forEach(pak => {
      filteredLoadOrder.push({
        id: pak.fileName,
        modId: pak.mod?.id,
        enabled: true,  // not using load order for enabling/disabling      
        name: pak.info?.name || path.basename(pak.fileName, '.pak'),
        data: pak.info,
        locked: pak.info.isListed as LockedState        
      })      
    });       

    //logDebug('deserialize filteredData=', filteredData);

    // sorted so that any mods that are locked appear at the top
    //const sortedAndFilteredData = 
    
    // return
    return filteredLoadOrder.sort((a, b) => (+b.locked - +a.locked));
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function importFromBG3MM(context: types.IExtensionContext): Promise<void> {
  const api = context.api;
  const options: IOpenOptions = {
    title: api.translate('Please choose a BG3MM .json load order file to import from'),
    filters: [{ name: 'BG3MM Load Order', extensions: ['json'] }]
  };

  const selectedPath:string = await api.selectFile(options);

  logDebug('importFromBG3MM selectedPath=', selectedPath);
  
  // if no path selected, then cancel probably pressed
  if(selectedPath === undefined) {
    return;
  }

  try {
    const data = await fs.readFileAsync(selectedPath, { encoding: 'utf8' });
    const loadOrder: any[] = JSON.parse(data);
    logDebug('importFromBG3MM loadOrder=', loadOrder);

    const getIndex = (uuid: string): number => {
      const index = loadOrder.findIndex(entry => entry.UUID !== undefined && entry.UUID === uuid);
      return index !== -1 ? index : Infinity; // If UUID not found, put it at the end
    };

    const state = api.getState();
    const profileId = selectors.activeProfile(state)?.id;
    const currentLoadOrder = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
    const newLO = [...currentLoadOrder].sort((a, b) => getIndex(a.data?.uuid) - getIndex(b.data?.uuid));
    await serialize(context, newLO, profileId);
  } catch (err) {
    api.showErrorNotification('Failed to import BG3MM load order file', err, { allowReport: false });
  } finally {
    forceRefresh(context.api);
  }
}

export async function importModSettingsFile(api: types.IExtensionApi): Promise<boolean | void> {

  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;

  const options: IOpenOptions = {
    title: api.translate('Please choose a BG3 .lsx file to import from'),
    filters: [{ name: 'BG3 Load Order', extensions: ['lsx'] }]
  };

  const selectedPath:string = await api.selectFile(options);

  logDebug('importModSettingsFile selectedPath=', selectedPath);
  
  // if no path selected, then cancel probably pressed
  if(selectedPath === undefined)
    return;

  processLsxFile(api, selectedPath);
}

export async function importModSettingsGame(api: types.IExtensionApi): Promise<boolean | void> {

  const bg3ProfileId = await getActivePlayerProfile(api);
  const gameSettingsPath: string = path.join(profilesPath(), bg3ProfileId, 'modsettings.lsx');

  logDebug('importModSettingsGame gameSettingsPath=', gameSettingsPath);

  processLsxFile(api, gameSettingsPath);
}

function checkIfDuplicateExists(arr) {
  return new Set(arr).size !== arr.length
}

function getAttribute(node: IModNode, name: string, fallback?: string):string {
  return findNode(node?.attribute, name)?.$?.value ?? fallback;
}

async function processBG3MMFile(api: types.IExtensionApi, jsonPath: string) {
  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;

  api.sendNotification({
    id: NOTIF_IMPORT_ACTIVITY,
    title: 'Importing JSON File',
    message: jsonPath,
    type: 'activity',
    noDismiss: true,
    allowSuppress: false,
  });

  try {

  } catch (err) {

  } finally {
    api.dismissNotification(NOTIF_IMPORT_ACTIVITY);
  }
}

export async function getNodes(lsxPath: string): Promise<any> {
  const lsxLoadOrder: IModSettings = await readLsxFile(lsxPath);
    logDebug('processLsxFile lsxPath=', lsxPath);

    // buildup object from xml
    const region = findNode(lsxLoadOrder?.save?.region, 'ModuleSettings');
    const root = findNode(region?.node, 'root');
    const modsNode = findNode(root?.children?.[0]?.node, 'Mods');
    const modsOrderNode = findNode(root?.children?.[0]?.node, 'ModOrder');

    return { region, root, modsNode, modsOrderNode };
}

export async function processLsxFile(api: types.IExtensionApi, lsxPath:string) {  

  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;

  api.sendNotification({
    id: NOTIF_IMPORT_ACTIVITY,
    title: 'Importing LSX File',
    message: lsxPath,
    type: 'activity',
    noDismiss: true,
    allowSuppress: false,
  });

  try {
    const { modsNode, modsOrderNode } = await getNodes(lsxPath);
    if ((modsNode?.children === undefined) || ((modsNode?.children[0] as any) === '')) {
      modsNode.children = [{ node: [] }];
    }

    const format = await getDefaultModSettingsFormat(api);
    let loNode = ['v7', 'v8'].includes(format) ? modsNode : modsOrderNode !== undefined ? modsOrderNode : modsNode;

    // get nice string array, in order, of mods from the load order section
    let uuidArray:string[] = loNode?.children !== undefined
      ? loNode.children[0].node.map((loEntry) => loEntry.attribute.find(attr => (attr.$.id === 'UUID')).$.value)
      : [];

    logDebug(`processLsxFile uuidArray=`, uuidArray);

    // are there any duplicates? if so...
    if(checkIfDuplicateExists(uuidArray)) {
      api.sendNotification({
        type: 'warning',
        id: 'bg3-loadorder-imported-duplicate',
        title: 'Duplicate Entries',
        message: 'Duplicate UUIDs found in the ModOrder section of the .lsx file being imported. This sometimes can cause issues with the load order.',
        
        //displayMS: 3000
      }); 
      
      // remove these duplicates after the first one
      uuidArray = Array.from(new Set(uuidArray));
    }   

    const lsxModNodes: IModNode[] = modsNode.children[0].node;

    /*
    // get mods, in the above order, from the mods section of the file 
    const lsxMods:IModNode[] = uuidArray.map((uuid) => {
      return lsxModNodes.find(modNode => modNode.attribute.find(attr => (attr.$.id === 'UUID') && (attr.$.value === uuid)));
    });*/

    logDebug(`processLsxFile lsxModNodes=`, lsxModNodes);

    // we now have all the information from file that we need

    // lets get all paks from the folder
    const paks = await readPAKs(api);

    // are there any pak files not in the lsx file?
    const missing = paks.reduce((acc, curr) => {  

      // if current pak has no associated pak, then we skip. we defintely aren't adding this pak if vortex hasn't managed it.
      if(curr.mod === undefined) {
        return acc;
      }

      // if current pak, which vortex has definately managed, isn't already in the lsx file, then this is missing and we need to load order
      if(lsxModNodes.find(lsxEntry => lsxEntry.attribute.find(attr => (attr.$.id === 'Name') && (attr.$.value === curr.info.name))) === undefined) 
        acc.push(curr);

      // skip this 
      return acc;
    }, []);

    logDebug('processLsxFile - missing pak files that have associated mods =', missing);

    // build a load order from the lsx file and add any missing paks at the end?

    //let newLoadOrder: types.ILoadOrderEntry[] = [];

    // loop through lsx mod nodes and find the pak they are associated with

    let newLoadOrder: types.ILoadOrderEntry[] = lsxModNodes.reduce((acc, curr) => {
      
      // find the bg3Pak this is refering too as it's easier to get all the information
      const pak = paks.find((pak) => pak.info.name === curr.attribute.find(attr => (attr.$.id === 'Name')).$.value);

      // if the pak is found, then we add a load order entry. if it isn't, then its prob been deleted in vortex and lsx has an extra entry
      if (pak !== undefined) {
        acc.push({
          id: pak.fileName,
          modId: pak?.mod?.id,
          enabled: true,        
          name: pak.info?.name || path.basename(pak.fileName, '.pak'),
          data: pak.info,
          locked: pak.info.isListed as LockedState        
        });
      }

      return acc;
    }, []);   

    logDebug('processLsxFile (before adding missing) newLoadOrder=', newLoadOrder);

    // Add any newly added mods to the bottom of the loadOrder.
    missing.forEach(pak => {
      newLoadOrder.push({
        id: pak.fileName,
        modId:  pak?.mod?.id,
        enabled: true,        
        name: pak.info?.name || path.basename(pak.fileName, '.pak'),
        data: pak.info,
        locked: pak.info.isListed as LockedState        
      })      
    });   

    logDebug('processLsxFile (after adding missing) newLoadOrder=', newLoadOrder);

    newLoadOrder.sort((a, b) => (+b.locked - +a.locked));

    logDebug('processLsxFile (after sorting) newLoadOrder=', newLoadOrder);

    // get load order
    //let loadOrder:types.LoadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);
    //logDebug('processLsxFile loadOrder=', loadOrder);

    // manualy set load order?
    api.store.dispatch(actions.setFBLoadOrder(profileId, newLoadOrder));

    //util.setSafe(api.getState(), ['persistent', 'loadOrder', profileId], newLoadOrder);

    // get load order again?
    //loadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);
    //logDebug('processLsxFile loadOrder=', loadOrder);

    api.dismissNotification('bg3-loadorder-import-activity');

    api.sendNotification({
      type: 'success',
      id: 'bg3-loadorder-imported',
      title: 'Load Order Imported',
      message: lsxPath,
      displayMS: 3000
    });

    logDebug('processLsxFile finished');

  } catch (err) {
    
    api.dismissNotification(NOTIF_IMPORT_ACTIVITY);

    api.showErrorNotification('Failed to import load order', err, {
      allowReport: false
    });
  }

}

async function exportTo(api: types.IExtensionApi, filepath: string) {

  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;

  // get load order from state
  const loadOrder:types.LoadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);

  logDebug('exportTo loadOrder=', loadOrder);

  try {
    // read the game bg3 modsettings.lsx so that we get the default game gustav thing?
    const modSettings = await readModSettings(api);
    const modSettingsFormat = await getDefaultModSettingsFormat(api);

    // buildup object from xml
    const region = findNode(modSettings?.save?.region, 'ModuleSettings');
    const root = findNode(region?.node, 'root');
    const modsNode = findNode(root?.children?.[0]?.node, 'Mods');

    if ((modsNode.children === undefined) || ((modsNode.children[0] as any) === '')) {
      modsNode.children = [{ node: [] }];
    }

    // drop all nodes except for the game entry
    const descriptionNodes = modsNode?.children?.[0]?.node?.filter?.(iter =>
      iter.attribute.find(attr => (attr.$.id === 'Name') && (attr.$.value.startsWith('Gustav')))) ?? [];

    const filteredPaks = loadOrder.filter(entry => !!entry.data?.uuid
                    && entry.enabled
                    && !entry.data?.isListed);

    logDebug('exportTo filteredPaks=', filteredPaks);

    // add new nodes for the enabled mods
    for (const entry of filteredPaks) {
      // const md5 = await util.fileMD5(path.join(modsPath(), key));

      /*
        <attribute id="Folder" type="LSString" value="ClassAdditions_c4fc3dc0-3222-cf3b-58cd-ccce8ce4c8f5"/>
        <attribute id="MD5" type="LSString" value="d678aeb54c6c1496c0eae71ce033e9fb"/>
        <attribute id="Name" type="LSString" value="Ilonias Changes"/>
        <attribute id="PublishHandle" type="uint64" value="4325285"/>
        <attribute id="UUID" type="guid" value="c4fc3dc0-3222-cf3b-58cd-ccce8ce4c8f5"/>
        <attribute id="Version64" type="int64" value="36028797018963970"/>
      */

      const attributeOrder = ['Folder', 'MD5', 'Name', 'PublishHandle', 'UUID', 'Version64', 'Version'];
      const attributes = (['v7', 'v8'].includes(modSettingsFormat))
        ? [
          { $: { id: 'Folder', type: 'LSString', value: entry.data.folder } },
          { $: { id: 'Name', type: 'LSString', value: entry.data.name } },
          { $: { id: 'PublishHandle', type: 'uint64', value: 0 } },
          { $: { id: 'Version64', type: 'int64', value: entry.data.version } },
          { $: { id: 'UUID', type: 'guid', value: entry.data.uuid } },
        ] : [
          { $: { id: 'Folder', type: 'LSWString', value: entry.data.folder } },
          { $: { id: 'Name', type: 'FixedString', value: entry.data.name } },
          { $: { id: 'UUID', type: 'FixedString', value: entry.data.uuid } },
          { $: { id: 'Version', type: 'int32', value: entry.data.version } },
        ];

      descriptionNodes.push({
        $: { id: 'ModuleShortDesc' },
        attribute: [].concat(attributes, [{ $: { id: 'MD5', type: 'LSString', value: entry.data.md5 } }])
          .sort( (a, b) => attributeOrder.indexOf(a.$.id) - attributeOrder.indexOf(b.$.id)),
      });
    }

    const loadOrderNodes = filteredPaks
      //.sort((lhs, rhs) => lhs.pos - rhs.pos) // don't know if we need this now
      .map((entry): IModNode => ({
        $: { id: 'Module' },
        attribute: [
          { $: { id: 'UUID', type: 'FixedString', value: entry.data.uuid } },
        ],
      }));

    modsNode.children[0].node = descriptionNodes;
    if (!['v7', 'v8'].includes(modSettingsFormat)) {
      let modOrderNode: IRootNode = findNode(root?.children?.[0]?.node, 'ModOrder');
      let insertNode = false;
      if (!modOrderNode) {
        insertNode = true;
        modOrderNode = { $: { id: 'ModOrder' }, children: [{ node: [] }] }
      }
      if ((modOrderNode.children === undefined) || ((modOrderNode.children[0] as any) === '')) {
        modOrderNode.children = [{ node: [] }];
      }
      modOrderNode.children[0].node = loadOrderNodes;
      if (insertNode && !!root?.children?.[0]?.node) {
        root?.children?.[0]?.node.splice(0, 0, modOrderNode);
      }
    }

    writeModSettings(api, modSettings, filepath);
    
    api.sendNotification({
      type: 'success',
      id: 'bg3-loadorder-exported',
      title: 'Load Order Exported',
      message: filepath,
      displayMS: 3000
    });

  } catch (err) {
    api.showErrorNotification('Failed to write load order', err, {
      allowReport: false,
      message: 'Please run the game at least once and create a profile in-game',
    });
  }  

}

export async function exportToFile(api: types.IExtensionApi): Promise<boolean | void> {

  let selectedPath:string;

  // an older version of Vortex might not have the updated api.saveFile function so will fallback
  // to the previous hack job of selectFile but actually writes
  
  if(api.saveFile !== undefined) {

    const options: ISaveOptions = {
      title: api.translate('Please choose a BG3 .lsx file to export to'),
      filters: [{ name: 'BG3 Load Order', extensions: ['lsx'] }],      
    };

    selectedPath = await api.saveFile(options);    

  } else {

    const options: IOpenOptions = {
      title: api.translate('Please choose a BG3 .lsx file to export to'),
      filters: [{ name: 'BG3 Load Order', extensions: ['lsx'] }],
      create: true
    };

    selectedPath = await api.selectFile(options);
  }

  logDebug(`exportToFile ${selectedPath}`);

  // if no path selected, then cancel probably pressed
  if(selectedPath === undefined)
    return;

  exportTo(api, selectedPath);
}
  
export async function exportToGame(api: types.IExtensionApi): Promise<boolean | void> {

  const bg3ProfileId = await getActivePlayerProfile(api);
  const settingsPath: string = path.join(profilesPath(), bg3ProfileId, 'modsettings.lsx');

  logDebug(`exportToGame ${settingsPath}`);

  exportTo(api, settingsPath);
}

export async function deepRefresh(api: types.IExtensionApi): Promise<boolean | void> {

  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;

  // get load order from state
  const loadOrder:types.LoadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);

  logDebug('deepRefresh', loadOrder);
}

async function readModSettings(api: types.IExtensionApi): Promise<IModSettings> {
  const bg3ProfileId = await getActivePlayerProfile(api);
  const settingsPath: string = path.join(profilesPath(), bg3ProfileId, 'modsettings.lsx');
  const dat = await fs.readFileAsync(settingsPath, { encoding: 'utf8' });
  logDebug('readModSettings', dat);
  return parseStringPromise(dat);
}

async function readLsxFile(lsxPath: string): Promise<IModSettings> {
  
  //const settingsPath = path.join(profilesPath(), 'Public', 'modsettings.lsx');
  const dat = await fs.readFileAsync(lsxPath);
  logDebug('lsxPath', dat);
  return parseStringPromise(dat);
}

async function writeModSettings(api: types.IExtensionApi, data: IModSettings, filepath: string): Promise<void> {
  const format = await getDefaultModSettingsFormat(api);
  const builder = (['v7', 'v8'].includes(format))
    ? new Builder({ renderOpts: { pretty: true, indent: '    ' }})
    : new Builder();
  const xml = builder.buildObject(data);
  try {
    await fs.ensureDirWritableAsync(path.dirname(filepath));
    await fs.writeFileAsync(filepath, xml);
  } catch (err) {
    api.showErrorNotification('Failed to write mod settings', err);
    return;
  }
}

export async function validate(prev: types.LoadOrder,
                               current: types.LoadOrder): Promise<any> {
  // Nothing to validate really - the game does not read our load order file
  //  and we don't want to apply any restrictions either, so we just
  //  return.
  return undefined;
}

async function readPAKs(api: types.IExtensionApi) : Promise<Array<ICacheEntry>> {
  const state = api.getState();
  const lsLib = getLatestLSLibMod(api);
  if (lsLib === undefined) {
    return [];
  }

  const paks = await readPAKList(api);

  // logDebug('paks', paks);

  let manifest;
  try {
    manifest = await util.getManifest(api, '', GAME_ID);
  } catch (err) {
    const allowReport = !['EPERM'].includes(err.code);
    api.showErrorNotification('Failed to read deployment manifest', err, { allowReport });
    return [];
  }
  api.sendNotification({
    type: 'activity',
    id: 'bg3-reading-paks-activity',
    message: 'Reading PAK files. This might take a while...',
  })
  const cache: PakInfoCache = PakInfoCache.getInstance(api);
  const res = await Promise.all(paks.map(async (fileName, idx) => {
    return util.withErrorContext('reading pak', fileName, () => {
      const func = async () => {
        try {
          const manifestEntry = manifest.files.find(entry => entry.relPath === fileName);
          const mod = (manifestEntry !== undefined)
            ? state.persistent.mods[GAME_ID]?.[manifestEntry.source]
            : undefined;

          const pakPath = path.join(modsPath(), fileName);
          return cache.getCacheEntry(api, pakPath, mod);
        } catch (err) {
          if (err instanceof DivineExecMissing) {
            const message = 'The installed copy of LSLib/Divine is corrupted - please '
              + 'delete the existing LSLib mod entry and re-install it. Make sure to '
              + 'disable or add any necessary exceptions to your security software to '
              + 'ensure it does not interfere with Vortex/LSLib file operations.';
            api.showErrorNotification('Divine executable is missing', message,
              { allowReport: false });
            return undefined;
          }
          // could happen if the file got deleted since reading the list of paks.
          // actually, this seems to be fairly common when updating a mod
          if (err.code !== 'ENOENT') {
            api.showErrorNotification('Failed to read pak. Please make sure you are using the latest version of LSLib by using the "Re-install LSLib/Divine" toolbar button on the Mods page.', err, {
              allowReport: false,
              message: fileName,
            });
          }
          return undefined;
        }
      };
      return Bluebird.resolve(func());
    });
  }));
  api.dismissNotification('bg3-reading-paks-activity');

  return res.filter(iter => iter !== undefined);
}

async function readPAKList(api: types.IExtensionApi) {
  let paks: string[];
  try {
    paks = (await fs.readdirAsync(modsPath()))
      .filter(fileName => path.extname(fileName).toLowerCase() === '.pak');
  } catch (err) {
    if (err.code === 'ENOENT') {
      try {
        await fs.ensureDirWritableAsync(modsPath(), () => Promise.resolve());
      } catch (err) {
        // nop
      }
    } else {
      api.showErrorNotification('Failed to read mods directory', err, {
        id: 'bg3-failed-read-mods',
        message: modsPath(),
      });
    }
    paks = [];
  }

  return paks;
}

function getLatestLSLibMod(api: types.IExtensionApi) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = state.persistent.mods[GAME_ID];
  if (mods === undefined) {
    log('warn', 'LSLib is not installed');
    return undefined;
  }
  const lsLib: types.IMod = Object.keys(mods).reduce((prev: types.IMod, id: string) => {
    if (mods[id].type === 'bg3-lslib-divine-tool') {
      const latestVer = util.getSafe(prev, ['attributes', 'version'], '0.0.0');
      const currentVer = util.getSafe(mods[id], ['attributes', 'version'], '0.0.0');
      try {
        if (semver.gt(currentVer, latestVer)) {
          prev = mods[id];
        }
      } catch (err) {
        log('warn', 'invalid mod version', { modId: id, version: currentVer });
      }
    }
    return prev;
  }, undefined);

  if (lsLib === undefined) {
    log('warn', 'LSLib is not installed');
    return undefined;
  }

  return lsLib;
}

export function genProps(context: types.IExtensionContext, profileId?: string): IProps {
  const api = context.api;
  const state = api.getState();
  const profile: types.IProfile = (profileId !== undefined)
    ? selectors.profileById(state, profileId)
    : selectors.activeProfile(state);

  if (profile?.gameId !== GAME_ID) {
    return undefined;
  }

  const discovery: types.IDiscoveryResult = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (discovery?.path === undefined) {
    return undefined;
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return { api, state, profile, mods, discovery };
}

export async function ensureLOFile(context: types.IExtensionContext,
                                   profileId?: string,
                                   props?: IProps): Promise<string> {
  if (props === undefined) {
    props = genProps(context, profileId);
  }

  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('failed to generate game props'));
  }

  const targetPath = loadOrderFilePath(props.profile.id);
  try {
    try {
      await fs.statAsync(targetPath);
    } catch (err) {
      await fs.writeFileAsync(targetPath, JSON.stringify([]), { encoding: 'utf8' });
    }
  } catch (err) {
    return Promise.reject(err);
  }    
  
  
  return targetPath;
}

export function loadOrderFilePath(profileId: string): string {
  return path.join(util.getVortexPath('userData'), GAME_ID, profileId + '_' + LO_FILE_NAME);
}

