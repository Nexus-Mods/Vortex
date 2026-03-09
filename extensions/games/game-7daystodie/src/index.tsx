import path from 'path';
import { useSelector } from 'react-redux';
import { actions, fs, selectors, types, util } from 'vortex-api';

import * as React from 'react';

import { setPrefixOffset } from './actions';
import { reducer } from './reducers';

import { GAME_ID, gameExecutable, MOD_INFO, launcherSettingsFilePath, DEFAULT_LAUNCHER_SETTINGS } from './common';
import { deserialize, serialize, validate } from './loadOrder';
import { migrate020, migrate100, migrate1011 } from './migrations';
import { ILoadOrderEntry, IProps } from './types';
import { genProps, getModName, getModsPath, makePrefix, reversePrefix, selectUDF, toBlue } from './util';
import Settings from './Settings';

const STEAM_ID = '251570';
const STEAM_DLL = 'steamclient64.dll';

const ROOT_MOD_CANDIDATES = ['bepinex'];

function resetPrefixOffset(api: types.IExtensionApi) {
  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;
  if (profileId === undefined) {
    // How ?
    api.showErrorNotification('No active profile for 7dtd', undefined, { allowReport: false });
    return;
  }

  api.store.dispatch(setPrefixOffset(profileId, 0));
  const loadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);
  const newLO = loadOrder.map((entry, idx) => ({
    ...entry,
    data: {
      prefix: makePrefix(idx),
    },
  }));
  api.store.dispatch(actions.setLoadOrder(profileId, newLO));
}

function setPrefixOffsetDialog(api: types.IExtensionApi) {
  return api.showDialog('question', 'Set New Prefix Offset', {
    text: api.translate('Insert new prefix offset for modlets (AAA-ZZZ):'),
    input: [
      {
        id: '7dtdprefixoffsetinput',
        label: 'Prefix Offset',
        type: 'text',
        placeholder: 'AAA',
      }],
  }, [ { label: 'Cancel' }, { label: 'Set', default: true } ])
  .then(result => {
    if (result.action === 'Set') {
      const prefix = result.input['7dtdprefixoffsetinput'];
      let offset = 0;
      try {
        offset = reversePrefix(prefix);
      } catch (err) {
        return Promise.reject(err);
      }
      const state = api.getState();
      const profileId = selectors.activeProfile(state)?.id;
      if (profileId === undefined) {
        // How ?
        api.showErrorNotification('No active profile for 7dtd', undefined, { allowReport: false });
        return;
      }

      api.store.dispatch(setPrefixOffset(profileId, offset));
      const loadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);
      const newLO = loadOrder.map(entry => ({
        ...entry,
        data: {
          prefix: makePrefix(reversePrefix(entry.data.prefix) + offset),
        },
      }));
      api.store.dispatch(actions.setLoadOrder(profileId, newLO));
    }
    return Promise.resolve();
  })
  .catch(err => {
    api.showErrorNotification('Failed to set prefix offset', err, { allowReport: false });
    return Promise.resolve();
  });
}

async function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID])
    .then(game => game.gamePath);
}

async function prepareForModding(context: types.IExtensionContext,
                                 discovery: types.IDiscoveryResult) {
  const isUDFSet = util.getSafe(context.api.getState(),
    ['settings', '7daystodie', 'udf'], undefined) != null;
  return (!isUDFSet) ? selectUDF(context) : Promise.resolve();
}

async function installContent(files: string[],
                              destinationPath: string,
                              gameId: string): Promise<types.IInstallResult> {
  // The modinfo.xml file is expected to always be positioned in the root directory
  //  of the mod itself; we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.basename(file).toLowerCase() === MOD_INFO);
  const rootPath = path.dirname(modFile);
  return getModName(path.join(destinationPath, modFile))
    .then(modName => {
      modName = modName.replace(/[^a-zA-Z0-9]/g, '');

      // Remove directories and anything that isn't in the rootPath (also directories).
      const filtered = files.filter(filePath =>
        filePath.startsWith(rootPath) && !filePath.endsWith(path.sep));

      const instructions: types.IInstruction[] = filtered.map(filePath => {
        return {
          type: 'copy',
          source: filePath,
          destination: path.relative(rootPath, filePath),
        };
      });

      return Promise.resolve({ instructions });
    });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  const supported = (gameId === GAME_ID) &&
    (files.find(file => path.basename(file).toLowerCase() === MOD_INFO) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function findCandFile(files: string[]): string {
  return files.find(file => file.toLowerCase().split(path.sep)
    .find(seg => ROOT_MOD_CANDIDATES.includes(seg)) !== undefined);
}

function hasCandidate(files: string[]): boolean {
  const candidate = findCandFile(files);
  return candidate !== undefined;
}

async function installRootMod(files: string[],
                              gameId: string): Promise<types.IInstallResult> {
  const filtered = files.filter(file => !file.endsWith(path.sep));
  const candidate = findCandFile(files);
  const candIdx = candidate.toLowerCase().split(path.sep)
    .findIndex(seg => ROOT_MOD_CANDIDATES.includes(seg));
  const instructions: types.IInstruction[] = filtered.reduce((accum, iter) => {
    accum.push({
      type: 'copy',
      source: iter,
      destination: iter.split(path.sep).slice(candIdx).join(path.sep),
    });
    return accum;
  }, []);
  return Promise.resolve({ instructions });
}

async function testRootMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  return Promise.resolve({
    requiredFiles: [],
    supported: hasCandidate(files) && gameId === GAME_ID,
  });
}

function toLOPrefix(context: types.IExtensionContext, mod: types.IMod): string {
  const props: IProps = genProps(context);
  if (props === undefined) {
    return 'ZZZZ-' + mod.id;
  }

  // Retrieve the load order as stored in Vortex's application state.
  const loadOrder = util.getSafe(props.state, ['persistent', 'loadOrder', props.profile.id], []);

  // Find the mod entry in the load order state and insert the prefix in front
  //  of the mod's name/id/whatever
  let loEntry: ILoadOrderEntry = loadOrder.find(loEntry => loEntry.id === mod.id);
  if (loEntry === undefined) {
    // The mod entry wasn't found in the load order state - this is potentially
    //  due to the mod being removed as part of an update or uninstallation.
    //  It's important we find the prefix of the mod in this case, as the deployment
    //  method could potentially fail to remove the mod! We're going to check
    //  the previous load order saved for this profile and use that if it exists.
    const prev = util.getSafe(props.state, ['settings', '7daystodie', 'previousLO', props.profile.id], []);
    loEntry = prev.find(loEntry => loEntry.id === mod.id);
  }

  return (loEntry?.data?.prefix !== undefined)
    ? loEntry.data.prefix + '-' + mod.id
    : 'ZZZZ-' + mod.id;
}

function requiresLauncher(gamePath) {
  return fs.readdirAsync(gamePath)
    .then(files => (files.find(file => file.endsWith(STEAM_DLL)) !== undefined)
      ? Promise.resolve({ launcher: 'steam' })
      : Promise.resolve(undefined))
    .catch(err => Promise.reject(err));
}

function InfoPanel(props) {
  const { t, currentOffset } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', alignItems: 'center' }}>
        {t('Current Prefix Offset: ')}
        <hr/>
        <label style={{ color: 'red' }}>{currentOffset}</label>
      </div>
      <hr/>
      <div>
        {t('7 Days to Die loads mods in alphabetic order so Vortex prefixes '
         + 'the directory names with "AAA, AAB, AAC, ..." to ensure they load in the order you set here.')}
      </div>
    </div>
  );
}

function InfoPanelWrap(props: { api: types.IExtensionApi, profileId: string }) {
  const { api, profileId } = props;
  const currentOffset = useSelector((state: types.IState) =>
    makePrefix(util.getSafe(state,
      ['settings', '7daystodie', 'prefixOffset', profileId], 0)));

  return (
    <InfoPanel
      t={api.translate}
      currentOffset={currentOffset}
    />
  );
}

function main(context: types.IExtensionContext) {
  context.registerReducer(['settings', '7daystodie'], reducer);

  context.registerGame({
    id: GAME_ID,
    name: '7 Days to Die',
    mergeMods: (mod) => toLOPrefix(context, mod),
    queryPath: toBlue(findGame),
    supportedTools: [],
    queryModPath: () => getModsPath(context.api),
    logo: 'gameart.jpg',
    executable: gameExecutable,
    requiredFiles: [
    ],
    requiresLauncher,
    setup: toBlue((discovery) => prepareForModding(context, discovery)),
    environment: {
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
      hashFiles: ['7DaysToDie_Data/Managed/Assembly-CSharp.dll'],
    },
  });

  context.registerLoadOrder({
    deserializeLoadOrder: () => deserialize(context),
    serializeLoadOrder: ((loadOrder, prev) => serialize(context, loadOrder, prev)) as any,
    validate,
    gameId: GAME_ID,
    toggleableEntries: false,
    usageInstructions: (() => {
      const state = context.api.getState();
      const profileId = selectors.activeProfile(state)?.id;
      if (profileId === undefined) {
        return null;
      }
      return (
        <InfoPanelWrap api={context.api} profileId={profileId} />
      );
    }) as any,
  });

  context.registerSettings('Mods', Settings, () => ({
    onSelectUDF: () => selectUDF(context).catch(() => null),
  }), () => {
    const state = context.api.getState();
    const activeGame = selectors.activeGameId(state);
    return activeGame === GAME_ID;
  });

  context.registerAction('fb-load-order-icons', 150, 'loot-sort', {},
                         'Prefix Offset Assign', () => {
    setPrefixOffsetDialog(context.api);
  }, () => {
    const state = context.api.getState();
    const activeGame = selectors.activeGameId(state);
    return activeGame === GAME_ID;
  });

  context.registerAction('fb-load-order-icons', 150, 'loot-sort', {},
                         'Prefix Offset Reset', () => {
    resetPrefixOffset(context.api);
  }, () => {
    const state = context.api.getState();
    const activeGame = selectors.activeGameId(state);
    return activeGame === GAME_ID;
  });

  const getOverhaulPath = (game: types.IGame) => {
    const state = context.api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    return discovery?.path;
  };

  context.registerInstaller('7dtd-mod', 25,
    toBlue(testSupportedContent), toBlue(installContent));

  context.registerInstaller('7dtd-root-mod', 20, toBlue(testRootMod), toBlue(installRootMod));
  context.registerModType('7dtd-root-mod', 20, (gameId) => gameId === GAME_ID,
    getOverhaulPath, (instructions) => {
      const candidateFound = hasCandidate(instructions
        .filter(instr => !!instr.destination)
        .map(instr => instr.destination));
      return Promise.resolve(candidateFound) as any;
    },
      { name: 'Root Directory Mod', mergeMods: true, deploymentEssential: false });

  context.registerMigration(toBlue(old => migrate020(context.api, old)));
  context.registerMigration(toBlue(old => migrate100(context, old)));
  context.registerMigration(toBlue(old => migrate1011(context, old)));

  return true;
}

module.exports = {
  default: main,
};
