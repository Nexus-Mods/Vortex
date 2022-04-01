const program = require('commander');
const fs = require('fs');
const _ = require('lodash');
const mdi = require('@mdi/js')
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

function rmFill(node) {
  Object.keys(node).forEach(n => {
    delete node[n].fill;
    if (n !== '$') {
      rmFill(node[n]);
    }
  });
}

function rmStroke(node) {
  Object.keys(node).forEach(n => {
    delete node[n].stroke;
    if (n !== '$') {
      rmStroke(node[n]);
    }
  });
}

function applyTransforms(svg, cfg) {
  if (svg.$ === undefined) {
    return svg;
  }
  if (cfg.rmFill) {
    rmFill(svg);
  }
  if (cfg.rmStroke) {
    rmStroke(svg);
  }
  if (cfg.scaleStroke === false) {
    svg.$['vector-effect'] = 'non-scaling-stroke';
  }
  if (svg.$['data-color'] !== undefined) {
    delete svg.$['data-color'];
  }
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

async function extractIcon(iconPath, iconCfg) {
  const dat = await fs.promises.readFile(iconPath, { encoding: 'utf8' });
  const result = await xml2js.parseStringPromise(dat.toString());
  return sanitize(result.svg, iconCfg);
}

function extractMDI(iconId, mdiId) {
  return Promise.resolve({
    $: {
      id: `icon-${iconId}`,
      viewBox: '0 0 24 24',
    },
    path: {
      $: {
        d: mdi[mdiId],
      },
    },
  });
}

async function extractLegacy(iconId, fullPath, iconcfg) {
  try {
    const icon = await extractIcon(fullPath, iconcfg)
    icon.$.id = 'icon-' + iconId;
    return icon;
  } catch (err) {
    return Promise.reject(err);
  }
}

function processConfig(basePath, config) {
  const symbol = [];

  return Promise.all(Object.keys(config.icons).map(iconId => {
    const iconCfg = typeof config.icons[iconId] === 'string'
      ? { path: config.icons[iconId] }
      : config.icons[iconId];
    const iconDat = (iconCfg.source === 'mdi')
      ? extractMDI(iconId, iconCfg.value)
      : extractLegacy(iconId, path.join(basePath, format(iconCfg.path, config.variables) + '.svg'), iconCfg)
    return iconDat
    .then(icon => {
      symbol.push(icon);
      return Promise.resolve();
    })
    .catch(err => {
      console.error('failed to extract icon', iconId, err.message);
      return Promise.resolve();
    })
  }))

    .then(() => {
      const builder = new xml2js.Builder();
      const outputPath = path.resolve('..', 'assets', 'fonts', 'icons.svg');

      return new Promise((resolve, reject) => {
        fs.writeFile(outputPath, builder.buildObject({
          svg: {
            $: { xmlns: 'http://www.w3.org/2000/svg', style: 'display: none;' },
            symbol,
          }
        }), (err) => {
          if (err !== null) {
            return reject(err);
          }
          resolve();
        });
      });
    });
}

function mergeIcons(legacy,  material) {
  return {
    variables: legacy.variables,
    icons: {
      ...legacy.icons,
      ...material,
    },
  };
}

async function main() {
  const params = commandLine();

  try {
    const legacyIcons =
      await fs.promises.readFile(params.config || 'iconconfig.json', { encoding: 'utf8' });
    const materialIcons =
      await fs.promises.readFile(params.mdiconfig || 'mdiconfig.json', { encoding: 'utf8' });

    const data = mergeIcons(JSON.parse(legacyIcons), JSON.parse(materialIcons));
    processConfig(params.base || '../icons', data);

  } catch (err) {
    console.error('failed', require('util').inspect(err));
    process.exit(1);
  }
}

main();
