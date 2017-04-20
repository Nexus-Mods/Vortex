import { types } from 'nmm-api';

function renderModName(mod: types.IMod) {
  if (mod === undefined) {
    return undefined;
  }
  let id = mod.attributes['customFileName']
    || mod.attributes['logicalFileName']
    || mod.attributes['name'];

  let version = mod.attributes['version'];

  return version !== undefined ? id + ' v' + version : id;
}

export default renderModName;
