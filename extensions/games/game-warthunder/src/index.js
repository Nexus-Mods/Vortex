const path = require('path');
const { fs, util } = require('vortex-api');

const AUDIO_EXT = '.fsb';
const CONFIG_FILE = 'config.blk';
const SOUND_CONFIG = `sound{
  speakerMode:t="auto"
  fmod_sound_enable:b=yes
  enable_mod:b=yes
}`;

function findGame() {
  return util.steam.findByName('War Thunder')
      .then(game => game.gamePath);
}

function modPath() {
  return 'UserSkins';
}

function modifyConfigFile(gameRootPath) {
  const configFilePath = path.join(gameRootPath, CONFIG_FILE);
  return fs.readFileAsync(configFilePath, { encoding: 'utf-8' })
    .then(data => {
      const modifiedData = data.replace(/^sound{[\s\S]*?}$/m, SOUND_CONFIG);
      return fs.writeFileAsync(configFilePath, modifiedData, { encoding: 'utf8' });
    })
}

function prepareForModding(discovery) {
  const soundModPath = path.join(discovery.path, 'sound', 'mod');
  return fs.ensureDirAsync(path.join(discovery.path, modPath()))
    .then(() => fs.ensureDirAsync(soundModPath))
    .then(() => modifyConfigFile(discovery.path));
}

function isAudioModType(instructions) {
  const audioFile = instructions.find(inst =>
    (inst.type === 'copy') && inst.source.endsWith(AUDIO_EXT));
  return Promise.resolve(audioFile !== undefined);
}

function main(context) {
  context.registerGame({
    id: 'warthunder',
    name: 'War Thunder',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: () => 'win64/aces.exe',
    requiredFiles: [
      'win64/aces.exe',
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: '236390',
    },
    details: {
      steamAppId: 236390,
    },
  });

  const getSoundModPath = (game) => {
    const state = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    return path.join(discovery.path, 'sound', 'mod');
  };

  context.registerModType('warthunder-audio-modtype', 25,
    gameId => gameId === 'warthunder', getSoundModPath, isAudioModType);

  return true;
}

module.exports = {
  default: main,
};
