import {getSafe} from '../../../util/storeHelper';

function transfer(info: any, key: string, source: any, path: string[]) {
  let value = getSafe(source, path, undefined);
  if (value !== undefined) {
    info[key] = value;
  }
}

function filterModInfo(input: any): any {
  let result = {};

  // TODO these should be extensions 
  transfer(result, 'modId', input.nexus, ['ids', 'modId']);
  transfer(result, 'fileId', input.nexus, ['ids', 'fileId']);
  transfer(result, 'version', input.nexus, ['fileInfo', 'version']);
  transfer(result, 'logicalFileName', input.nexus, ['fileInfo', 'name']);

  transfer(result, 'modId', input.meta, ['modId']);
  transfer(result, 'modName', input.meta, ['modName']);
  transfer(result, 'fileName', input.meta, ['fileName']);
  transfer(result, 'fileMD5', input.meta, ['fileMD5']);
  transfer(result, 'version', input.meta, ['fileVersion']);
  transfer(result, 'logicalFileName', input.meta, ['logicalFileName']);
  transfer(result, 'rules', input.meta, ['rules']);

  return result;
}

export default filterModInfo;
