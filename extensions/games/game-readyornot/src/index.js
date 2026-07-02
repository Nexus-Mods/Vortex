// Game registration adapted from BeYkeRYkt/vortex_readyornot_extension.
// Variant conflict detection is new.
'use strict';

const path = require('path');
const { actions, fs, selectors, util } = require('@nexusmods/vortex-api');

const { VARIANT_GROUPS } = require('./variantGroups');
const { detectConflicts } = require('./conflictDetector');

// ---------------------------------------------------------------------------
// Game constants
// ---------------------------------------------------------------------------

const GAME_ID        = 'readyornot';
const GAME_NAME      = 'Ready Or Not';
const GAME_CODE_NAME = 'ReadyOrNot';
const GAME_PLATFORM  = 'Win64';
const STEAMAPP_ID    = '1144200';
const EPICAPP_ID     = '07e0052292f44e71a1efeb219d060ea5';

const EXEC_SUBPATH = path.join(GAME_CODE_NAME, 'Binaries', GAME_PLATFORM);
const MODS_PATH    = path.join(GAME_CODE_NAME, 'Content', 'Paks', '~mods');
const FMOD_PATH    = path.join(GAME_CODE_NAME, 'Content', 'FMOD', 'Desktop');
const CONFIG_PATH  = path.join(GAME_CODE_NAME, 'Saved', 'Config', 'Windows');
const LO_FILE_NAME = 'loadOrder.json';

// ---------------------------------------------------------------------------
// Variant conflict detection
// ---------------------------------------------------------------------------

function getEnabledMods(api) {
  const state   = api.getState();
  const profile = selectors.activeProfile(state);
  if (!profile || profile.gameId !== GAME_ID) return [];

  const mods     = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});

  return Object.keys(modState)
    .filter(id => util.getSafe(modState, [id, 'enabled'], false))
    .map(id => mods[id])
    .filter(Boolean)
    .map(mod => ({
      name:       util.renderModName(mod),
      nexusModId: util.getSafe(mod, ['attributes', 'modId'], undefined),
    }));
}

function runVariantCheck(api) {
  const state   = api.getState();
  const profile = selectors.activeProfile(state);
  if (!profile || profile.gameId !== GAME_ID) return;

  const groups    = VARIANT_GROUPS.filter(g => g.gameId === GAME_ID);
  const mods      = getEnabledMods(api);
  const conflicts = detectConflicts(mods, groups);

  // Dismiss stale notifications before re-evaluating.
  groups.forEach(g => api.dismissNotification(`variant-conflict-${g.id}`));

  for (const conflict of conflicts) {
    const variantList = conflict.hits
      .map(h => `• ${h.modName} (${h.variantLabel})`)
      .join('\n');

    api.sendNotification({
      id:      `variant-conflict-${conflict.groupId}`,
      type:    'warning',
      title:   `Conflicting variants: ${conflict.displayName}`,
      message: `You have ${conflict.hits.length} mutually exclusive variants enabled:\n`
             + variantList
             + '\n\nThe mod author recommends enabling only one variant at a time.',
    });
  }
}

// ---------------------------------------------------------------------------
// Game discovery
// ---------------------------------------------------------------------------

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAMAPP_ID, EPICAPP_ID])
    .then(game => game.gamePath);
}

function getExecutable(discoveryPath) {
  const egsExec = path.join(discoveryPath, `${GAME_CODE_NAME}EGS.exe`);
  try {
    fs.statSync(egsExec);
    return `${GAME_CODE_NAME}EGS.exe`;
  } catch (_) {
    return `${GAME_CODE_NAME}.exe`;
  }
}

async function prepareForModding(discovery) {
  const localAppData = process.env['LOCALAPPDATA'];
  await fs.ensureDirWritableAsync(path.join(localAppData, CONFIG_PATH));
  return fs.ensureDirWritableAsync(path.join(discovery.path, MODS_PATH));
}

// ---------------------------------------------------------------------------
// Load order
// ---------------------------------------------------------------------------

function generateProps(context, profileId) {
  const api     = context.api;
  const state   = api.getState();
  const profile = profileId
    ? selectors.profileById(state, profileId)
    : selectors.activeProfile(state);

  if (profile?.gameId !== GAME_ID) return undefined;

  const discovery = util.getSafe(
    state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined
  );
  if (discovery?.path === undefined) return undefined;

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return { api, state, profile, mods, discovery };
}

function makePrefix(input) {
  let res = '';
  let rest = input;
  while (rest > 0) {
    res  = String.fromCharCode(65 + (rest % 25)) + res;
    rest = Math.floor(rest / 25);
  }
  return util.pad(res, 'A', 3);
}

function toLOPrefix(context, mod) {
  const props = generateProps(context);
  if (props === undefined) return 'ZZZZ-';

  const loadOrder = util.getSafe(
    props.state, ['persistent', 'loadOrder', props.profile.id], []
  );
  const index = loadOrder.findIndex(e => e.id === mod.id);
  return index === -1 ? 'ZZZZ-' : makePrefix(index) + '-';
}

async function ensureLOFile(context, profileId, props) {
  if (props === undefined) props = generateProps(context, profileId);
  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('failed to generate game props'));
  }

  const targetPath = path.join(
    props.discovery.path, `${props.profile.id}_${LO_FILE_NAME}`
  );

  await fs.statAsync(targetPath).catch(
    { code: 'ENOENT' },
    () => fs.writeFileAsync(targetPath, JSON.stringify([]), { encoding: 'utf8' })
  );
  return targetPath;
}

async function serialize(context, loadOrder) {
  const props = generateProps(context);
  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('invalid props'));
  }

  const loFilePath = await ensureLOFile(context, props.profile.id, props);
  const filteredLO = loadOrder.filter(
    lo => props.mods?.[lo?.modId]?.type === 'ue4-sortable-modtype'
  );

  await fs.removeAsync(loFilePath).catch({ code: 'ENOENT' }, () => Promise.resolve());
  await fs.writeFileAsync(loFilePath, JSON.stringify(filteredLO, null, 4), { encoding: 'utf8' });
  context.api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
}

async function deserialize(context) {
  const props = generateProps(context);
  if (props?.profile?.gameId !== GAME_ID) return [];

  const currentModsState = util.getSafe(props.profile, ['modState'], {});
  const enabledModIds    = Object.keys(currentModsState)
    .filter(id => util.getSafe(currentModsState, [id, 'enabled'], false));
  const mods       = util.getSafe(props.state, ['persistent', 'mods', GAME_ID], {});
  const loFilePath = await ensureLOFile(context, props.profile.gameId, props);
  const fileData   = await fs.readFileAsync(loFilePath, { encoding: 'utf8' });

  let data = [];
  try {
    data = JSON.parse(fileData);
  } catch (err) {
    await new Promise((resolve, reject) => {
      props.api.showDialog('error', 'Corrupt load order file', {
        bbcode: props.api.translate(
          'The load order file is corrupt. Vortex can regenerate it, '
          + 'but that may result in loss of manually added load order items.'
        ),
      }, [
        { label: 'Cancel',          action: () => reject(err) },
        { label: 'Regenerate File', action: () => { data = []; resolve(); } },
      ]);
    });
  }

  const filteredData = data.filter(e => enabledModIds.includes(e.id));
  const diff = enabledModIds.filter(
    id =>
      ['ue4-sortable-modtype'].includes(mods[id]?.type) &&
      filteredData.find(e => e.id === id) === undefined
  );

  diff.forEach(id => {
    filteredData.push({
      id,
      modId:   id,
      enabled: true,
      name:    mods[id] ? util.renderModName(mods[id]) : id,
    });
  });

  return filteredData;
}

// ---------------------------------------------------------------------------
// Mod installers
// ---------------------------------------------------------------------------

function testFmod(files, gameId) {
  const supported = gameId === GAME_ID
    && files.some(f => path.extname(f).toLowerCase() === '.bank');
  return Promise.resolve({ supported, requiredFiles: [] });
}

function installFmod(files) {
  const modFile = files.find(f => path.extname(f).toLowerCase() === '.bank');
  const idx     = modFile.indexOf(path.basename(modFile));
  const filtered = files.filter(
    f => f.startsWith(path.dirname(modFile)) && !f.endsWith(path.sep)
  );
  return Promise.resolve({
    instructions: [
      ...filtered.map(f => ({ type: 'copy', source: f, destination: f.slice(idx) })),
      { type: 'setmodtype', value: `${GAME_ID}-fmod` },
    ],
  });
}

function testFallback(files, gameId) {
  return Promise.resolve({ supported: gameId === GAME_ID, requiredFiles: [] });
}

function installFallback(files) {
  const filtered = files.filter(f => !f.endsWith(path.sep));
  return Promise.resolve({
    instructions: [
      ...filtered.map(f => ({ type: 'copy', source: f, destination: f })),
      { type: 'setmodtype', value: `${GAME_ID}-binaries` },
    ],
  });
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

function main(context) {
  context.requireExtension('Unreal Engine Mod Installer');

  context.registerGame({
    id:              GAME_ID,
    name:            GAME_NAME,
    mergeMods:       true,
    queryPath:       findGame,
    requiresCleanup: true,
    supportedTools:  [],
    queryModPath:    () => '.',
    compatible:      { unrealEngine: true },
    logo:            'gameart.jpg',
    executable:      getExecutable,
    requiredFiles:   [GAME_CODE_NAME],
    setup:           prepareForModding,
    environment:     { SteamAPPId: STEAMAPP_ID, EpicAPPId: EPICAPP_ID },
    details: {
      unrealEngine: {
        modsPath:            MODS_PATH,
        fileExt:             '.pak',
        loadOrder:           true,
        loadOrderPrefixFunc: (mod) => toLOPrefix(context, mod),
      },
      steamAppId:        STEAMAPP_ID,
      EpicAPPId:         EPICAPP_ID,
      customOpenModsPath: MODS_PATH,
    },
    modTypes: [
      { id: `${GAME_ID}-binaries`, name: 'Binaries', priority: 'high', targetPath: `{gamePath}\\${EXEC_SUBPATH}` },
      { id: `${GAME_ID}-fmod`,     name: 'FMOD',     priority: 'high', targetPath: `{gamePath}\\${FMOD_PATH}` },
      { id: `${GAME_ID}-root`,     name: 'Root',     priority: 'high', targetPath: '{gamePath}' },
    ],
  });

  context.registerInstaller(`${GAME_ID}-fmod`,     45, testFmod,     installFmod);
  context.registerInstaller(`${GAME_ID}-fallback`, 85, testFallback, installFallback);

  context.registerLoadOrder({
    gameId:               GAME_ID,
    validate:             async () => Promise.resolve(undefined),
    deserializeLoadOrder: async () => deserialize(context),
    serializeLoadOrder:   async (lo) => serialize(context, lo),
    toggleableEntries:    false,
    usageInstructions:
      'Drag and drop mods to change the load order. Ready or Not loads mods in '
      + 'alphanumerical order; Vortex prefixes folder names with "AAA, AAB, AAC, ..." '
      + 'to match the order you set here.',
  });

  // Variant conflict detection
  context.api.events.on('profile-did-change', () => runVariantCheck(context.api));
  context.api.events.on('mods-enabled',       () => runVariantCheck(context.api));
  context.once(() => runVariantCheck(context.api));
}

module.exports = { default: main };
