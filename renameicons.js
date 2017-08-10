const fs = require('fs');
const _ = require('lodash');
const xml2js = require('xml2js');

const nameMap = {
  'fat-add': 'plus',
  'select-83': 'arrow-updown',
  'link-69': 'chain',
  'link-broken-70': 'chain-broken',
  'skew-up': 'up',
  'skew-down': 'down',
  'skew-left': 'left',
  'skew-right': 'right',
  ungroup: 'clone',
  'settings-gear-64': 'cog',
  'system-update': 'import',
  newsletter: 'message',
  'puzzle-10': 'puzzle',
  'disk-2': 'save',
  'settings-tool-67': 'wrench',
  txt: 'file-text',
  bars: 'spinner',
  'eye-ban-18': 'eye-slash',
  'button-play': 'play',
  'button-circle-play': 'circle-play',
  'alert-i': 'info',
  'single-content-03': 'file-small',
  'zoom-bold': 'search',
  'check-square-o': 'square-check',
  'check-curve': 'check',
  'square-o': 'square-empty',
  'folder-18': 'folder-open',
  'circle-08': 'user',
  alert: 'triangle-alert',
  preferences: 'sliders',
  'layout-11': 'dashboard',
  'list-bullet': 'list',
  trash: 'remove',
  'hierarchy-53': 'sitemap',
  'square-download': 'download',
  'alert-circle-que': 'circle-question',
  'alert-circle-exc': 'circle-exclamation',
  'alert-circle-i': 'circle-question',
  'alert-square-exc': 'square-exclamation',
  'alert-square-i': 'square-info',
  'bold-remove': 'cross',
  logo: 'nexus',
  world: 'globe',
  centralize: 'compress',
  disperse: 'expand',
  'dashboard-half': 'tachometer',
};

function transformId(id) {
  return id
    .replace(/^nc-(.*)/, (m, match) => 'icon-' + (nameMap[match] || match))
    .replace(/-[0-9]+$/, '');
}

function transformAttributes(attrs) {
  const res = Object.assign({}, attrs);
  res.id = transformId(res.id);
  return res;
}

const data = fs.readFileSync('fonts/myicons/svg/img/nc-icons.svg');

const parsed = xml2js.parseString(data.toString(), (err, result) => {
  if (err !== null) {
    console.error('failed to parse input svg');
    return;
  }
  result.svg.symbol = result.svg.symbol.map(sym => Object.assign(_.omit(sym, ['title']), {
    $: transformAttributes(sym.$),
  }));
  const builder = new xml2js.Builder();
  fs.writeFileSync('assets/fonts/vortex.svg', builder.buildObject(result));
  // console.log('res', require('util').inspect(result, { depth: 1000 }));
});
