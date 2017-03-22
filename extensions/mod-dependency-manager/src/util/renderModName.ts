import { types } from 'nmm-api';

function renderModName(mod: types.IMod) {
  if (mod === undefined) {
    return undefined;
  }
  // tslint:disable:no-string-literal
  let id = mod.attributes['customFileName']
    || mod.attributes['logicalFileName']
    || mod.attributes['name'];

  let version = mod.attributes['version'];
  // tslint:enable:no-string-literal

  return version !== undefined ? id + ' v' + version : id;
}

export default renderModName;
