const Promise = require('bluebird');
const { parseStringPromise } = require('xml2js');
const path = require('path');
const { fs, log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('X Rebirth')
      .then(game => game.gamePath);
}

function testSupported(files, gameId) {
  if (gameId !== 'xrebirth') {
    return Promise.resolve({ supported: false });
  }

  const contentPath = files.find(file => path.basename(file) === 'content.xml');
  return Promise.resolve({
    supported: contentPath !== undefined,
    requiredFiles: [ contentPath ],
  });
}

function install(files,
                 destinationPath,
                 gameId,
                 progressDelegate) {
  const contentPath = files.find(file => path.basename(file) === 'content.xml');
  const basePath = path.dirname(contentPath);

  let outputPath = basePath;

  return fs.readFileAsync(path.join(destinationPath, contentPath),
                          { encoding: 'utf8' })
      .then(async data => {
        let parsed;
        try {
          parsed = await parseStringPromise(data);
        } catch (err) { 
          return Promise.reject(new util.DataInvalid('content.xml invalid: ' + err.message));
        }
        const attrInstructions = [];

        const getAttr = key => {
          try {
            return parsed?.content?.$?.[key];
          } catch (err) {
            log('info', 'attribute missing in content.xml',  { key });
          }
        }

        outputPath = getAttr('id');
        if (outputPath === undefined) {
          return Promise.reject(
              new util.DataInvalid('invalid or unsupported content.xml'));
        }
        attrInstructions.push({
          type: 'attribute',
          key: 'customFileName',
          value: getAttr('name').trim(),
        });
        attrInstructions.push({
          type: 'attribute',
          key: 'description',
          value: getAttr('description'),
        });
        attrInstructions.push({
          type: 'attribute',
          key: 'sticky',
          value: getAttr('save') === 'true',
        });
        attrInstructions.push({
          trype: 'attribute',
          key: 'author',
          value: getAttr('author'),
        });
        attrInstructions.push({
          type: 'attribute',
          key: 'version',
          value: getAttr('version'),
        });
        return Promise.resolve(attrInstructions);
      })
      .then(attrInstructions => {
        let instructions = attrInstructions.concat(
            files.filter(file => file.startsWith(basePath + path.sep) &&
                                 !file.endsWith(path.sep))
                .map(file => ({
                       type: 'copy',
                       source: file,
                       destination: path.join(
                           outputPath, file.substring(basePath.length + 1))
                     })));
        return { instructions };
      });
}

function main(context) {
  context.registerGame({
    id: 'xrebirth',
    name: 'X Rebirth',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'extensions',
    logo: 'gameart.jpg',
    executable: () => 'XRebirth.exe',
    requiredFiles: [
      'XRebirth.exe',
    ],
    environment: {
      SteamAPPId: '2870',
    },
    details: {
      steamAppId: 2870,
    },
  });

  context.registerInstaller('xrebirth', 50, testSupported, install);

  return true;
}

module.exports = {
  default: main,
};
