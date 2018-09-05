import { getSafe } from '../../../util/storeHelper';

import versionClean from './versionClean';

export type UpdateState =
  'bug-update' | 'bug-update-site' | 'bug-disable' |
  'update' | 'update-site' | 'current' | 'install';

function updateState(attributes: { [id: string]: any }): UpdateState {
  const fileId: string = getSafe(attributes, ['fileId'], undefined);
  const version: string = getSafe(attributes, ['version'], undefined);
  const newestFileId: string = getSafe(attributes, ['newestFileId'], undefined);
  const newestVersion: string = getSafe(attributes, ['newestVersion'], undefined);
  const bugMessage: string = getSafe(attributes, ['bugMessage'], undefined);

  let hasUpdate = false;
  if ((newestFileId !== undefined) && (fileId !== undefined) && (newestFileId !== fileId)) {
    hasUpdate = true;
  } else if ((newestVersion !== undefined) && (version !== undefined)
             && (versionClean(newestVersion) !== versionClean(version))) {
    hasUpdate = true;
  }

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
