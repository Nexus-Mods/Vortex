import { types } from 'nmm-api';

function renderModName(mod: types.IMod) {
  if (mod === undefined) {
    return undefined;
  }
  const id = mod.attributes['customFileName']
    || mod.attributes['logicalFileName']
    || mod.attributes['name'];

  const version = mod.attributes['version'];

  return version !== undefined ? id + ' v' + version : id;
}

export default renderModName;
