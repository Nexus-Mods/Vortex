const Promise = require('bluebird');
const fs = require('fs-extra-promise');
const path = require('path');
const { log, util } = require('vortex-api');
const { Parser } = require('xml2js');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let xrebirth = games.find((entry) => entry.name === 'X Rebirth');
    if (xrebirth !== undefined) {
      return xrebirth.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
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
                          {encoding: 'utf8'})
      .then(data => new Promise((resolve, reject) => {
              const parser = new Parser();
              parser.parseString(data, (err, parsed) => {
                console.log('parsed content', err, parsed);
                if (err !== null) {
                  return reject(err);
                }

                try {
                  const attrInstructions = [];
                  outputPath = parsed.content.$.id;
                  if (outputPath === undefined) {
                    return reject(
                        new Error('invalid or unsupported content.xml'));
                  }
                  attrInstructions.push({
                    type: 'attribute',
                    key: 'customFileName',
                    value: parsed.content.$.name.trim(),
                  });
                  attrInstructions.push({
                    type: 'attribute',
                    key: 'description',
                    value: parsed.content.$.description,
                  });
                  attrInstructions.push({
                    type: 'attribute',
                    key: 'sticky',
                    value: parsed.content.$.save === 'true',
                  });
                  attrInstructions.push({
                    trype: 'attribute',
                    key: 'author',
                    value: parsed.content.$.author,
                  });
                  attrInstructions.push({
                    type: 'attribute',
                    key: 'version',
                    value: parsed.content.$.version,
                  });
                  resolve(attrInstructions);
                } catch (parseErr) {
                  return reject(
                      new Error('failed to determine correct mod directory'));
                }
              });
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
