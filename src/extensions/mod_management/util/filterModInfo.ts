import {getSafe} from '../../../util/storeHelper';

function transfer(info: any, key: string, source: any, path: string[]) {
  const value = getSafe(source, path, undefined);
  if (value !== undefined) {
    info[key] = value;
  }
}

function filterModInfo(input: any): any {
  const result: any = {};

  // TODO these should be extensions
  transfer(result, 'modId', input.nexus, ['ids', 'modId']);
  transfer(result, 'fileId', input.nexus, ['ids', 'fileId']);
  transfer(result, 'fileType', input.nexus, ['fileInfo', 'category_name']);
  transfer(result, 'isPrimary', input.nexus, ['fileInfo', 'is_primary']);
  transfer(result, 'fileName', input.nexus, ['fileInfo', 'name']);
  const nexusChangelog = getSafe(input.nexus, ['fileInfo', 'changelog_html'], undefined);
  if (nexusChangelog !== undefined) {
    result.changelog = { format: 'html', content: nexusChangelog };
  }
  transfer(result, 'uploadedTimestamp', input.nexus, ['fileInfo', 'uploaded_timestamp']);
  transfer(result, 'version', input.nexus, ['fileInfo', 'version']);

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

  return result;
}

export default filterModInfo;
