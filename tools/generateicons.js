const program = require('commander');
const fs = require('fs-extra');
const _ = require('lodash');
const path = require('path');
const format = require('string-template');
const xml2js = require('xml2js');

function commandLine() {
  return program
    .version('0.1')
    .option('-b, --base <PATH>', 'path with all icon packs extracted')
    .option('-c, --config <PATH>', 'path to the configuration file')
    .parse(process.argv || []);
}

function applyTransforms(svg, cfg) {
  if (cfg.rmFill) {
    delete svg.$.fill;
  }
  delete svg.$['data-color'];
  return svg;
}

function sanitize(svg, iconCfg) {
  Object.keys(svg).forEach(key => {
    if (key === '$') {
      svg[key] = _.pick(svg.$, ['viewBox']);
    } else if (['g', 'path', 'rect', 'ellipsis', 'circle', 'polygon', 'polyline'].indexOf(key) !== -1) {
      svg[key] = svg[key].map(item => applyTransforms(item, iconCfg));
    } else if (['style'].indexOf(key) !== -1) {
      // nop
    } else {
      delete svg[key];
    }
  });
  return svg;
}

function extractIcon(iconPath, iconCfg) {
  return fs.readFile(iconPath)
    .then(data => new Promise((resolve, reject) => {
      xml2js.parseString(data.toString(), (err, result) => {
        if (err !== null) {
          return reject(err);
        }

        resolve(sanitize(result.svg, iconCfg));
      });
    }));
}

function processConfig(basePath, config) {
  const symbol = [];

  return Promise.all(Object.keys(config.icons).map(iconId => {
    const iconCfg = typeof config.icons[iconId] === 'string'
      ? { path: config.icons[iconId] }
      : config.icons[iconId];
    return extractIcon(path.join(basePath, format(iconCfg.path, config.variables) + '.svg'), iconCfg)
      .then(icon => {
        icon.$.id = 'icon-' + iconId;
        symbol.push(icon);
      });
    }))
    .then(() => {
      const builder = new xml2js.Builder();
      const outputPath = path.resolve('..', 'assets', 'fonts', 'icons.svg');

      return fs.writeFile(outputPath, builder.buildObject({
        svg: {
          $: { xmlns: 'http://www.w3.org/2000/svg', style: 'display: none;' },
          symbol,
        }
      }))
      .then(() => console.log('done'));
    });
}

function main() {
  const params = commandLine();
  return fs.readFile(params.config || 'iconconfig.json')
    .then(data => processConfig(params.base || '../icons', JSON.parse(data.toString())))
    .catch(err => console.error('failed', err.message));
}

main().then(exitCode => process.exit(exitCode));
