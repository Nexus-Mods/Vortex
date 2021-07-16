import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IModWithState } from '../types/IModProps';

import versionClean from './versionClean';

export function isIdValid(mod: IModWithState) {
  return (mod.state !== 'installed')
      || (mod.attributes.source === 'unsupported')
      || (mod.type === 'collection')
      || ((mod.attributes?.fileId !== undefined) || (mod.attributes?.revisionId));
}

export type UpdateState =
  'bug-update' | 'bug-update-site' | 'bug-disable' |
  'update' | 'update-site' | 'current' | 'install';

function updateState(attributes: { [id: string]: any }): UpdateState {
  if (!truthy(getSafe(attributes, ['source'], undefined))) {
    // if no source associated there can't be an update
    return 'current';
  }
  const fileId: string = getSafe(attributes, ['fileId'], undefined);
  const version: string = getSafe(attributes, ['version'], undefined);
  const newestFileId: string = getSafe(attributes, ['newestFileId'], undefined);
  const newestVersion: string = getSafe(attributes, ['newestVersion'], undefined);
  const bugMessage: string = getSafe(attributes, ['bugMessage'], undefined);

  // installed file is in the OLD_VERSION group or not available at all
  const hasUpdate = (newestFileId === 'unknown')
    // we know the newest file id and the current file id and they are not the same
    || ((newestFileId !== undefined) && (fileId !== undefined) && (newestFileId !== fileId))
    // we know the newest version and the current version and the are not the same
    || ((newestVersion !== undefined)
        && (version !== undefined)
        && (versionClean(newestVersion) !== versionClean(version)));

  if (hasUpdate) {
    // if the newest file id is unknown this means there *is* an update (according to the
    // site-specific update mechanism) but we don't know which file it is
    if (newestFileId === 'unknown') {
      return bugMessage ? 'bug-update-site' : 'update-site';
    } else {
      return bugMessage ? 'bug-update' : 'update';
    }
  } else {
    return bugMessage ? 'bug-disable' : 'current';
  }
}

export default updateState;
