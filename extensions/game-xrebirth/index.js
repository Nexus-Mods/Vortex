const Promise = require('bluebird');
const { parseXmlString } = require('libxmljs');
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
      .then(data => new Promise((resolve, reject) => {
        try {
          const parsed = parseXmlString(data);
          const attrInstructions = [];

          outputPath = parsed.get('//content').attr('id').value();
          if (outputPath === undefined) {
            return reject(
                new Error('invalid or unsupported content.xml'));
          }
          attrInstructions.push({
            type: 'attribute',
            key: 'customFileName',
            value: parsed.get('//content').attr('name').value().trim(),
          });
          attrInstructions.push({
            type: 'attribute',
            key: 'description',
            value: parsed.get('//content').attr('description').value(),
          });
          attrInstructions.push({
            type: 'attribute',
            key: 'sticky',
            value: parsed.get('//content').attr('save').value() === 'true',
          });
          attrInstructions.push({
            trype: 'attribute',
            key: 'author',
            value: parsed.get('//content').attr('author').value(),
          });
          attrInstructions.push({
            type: 'attribute',
            key: 'version',
            value: parsed.get('//content').attr('version').value(),
          });
          resolve(attrInstructions);
        } catch (parseErr) {
          return reject(
              new Error('failed to determine correct mod directory'));
        }
      }))
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
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'extensions',
    logo: 'gameart.png',
    executable: () => 'XRebirth.exe',
    requiredFiles: [
      'XRebirth.exe',
    ],
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
