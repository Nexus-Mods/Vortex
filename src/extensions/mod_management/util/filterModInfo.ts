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

  transfer(result, 'modId', input.meta, ['modId']);
  transfer(result, 'modName', input.meta, ['modName']);
  transfer(result, 'fileName', input.meta, ['fileName']);
  transfer(result, 'fileMD5', input.meta, ['fileMD5']);
  transfer(result, 'fileSize', input.meta, ['fileSize']);
  transfer(result, 'version', input.meta, ['fileVersion']);
  transfer(result, 'logicalFileName', input.meta, ['logicalFileName']);
  transfer(result, 'rules', input.meta, ['rules']);
  transfer(result, 'category', input.meta, ['details', 'category']);
  transfer(result, 'description', input.meta, ['details', 'description']);
  transfer(result, 'author', input.meta, ['details', 'author']);
  transfer(result, 'homepage', input.meta, ['details', 'homepage']);
  transfer(result, 'fileId', input.meta, ['fileId']);
  transfer(result, 'changelogHtml', input.meta, ['changelogHtml']);
  transfer(result, 'version', input.meta, ['fileVersion']);
  transfer(result, 'logicalFileName', input.meta, ['fileName']);
  transfer(result, 'uploadedTimestamp', input.meta, ['uploadedTimestamp']);
  transfer(result, 'fileCategory', input.meta, ['fileCategory']);
  transfer(result, 'isPrimary', input.meta, ['isPrimary']);

  return result;
}

export default filterModInfo;
