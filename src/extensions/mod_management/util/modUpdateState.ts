import {getSafe} from '../../../util/storeHelper';
import {IModWithState} from '../types/IModProps';

export type UpdateState =
  'bug-update' | 'bug-update-site' | 'bug-disable' | 'update' | 'update-site' | 'current';

function updateState(mod: IModWithState): UpdateState {
  const fileId: string = getSafe(mod.attributes, ['fileId'], undefined);
  const newestFileId: string = getSafe(mod.attributes, ['newestFileId'], undefined);
  const bugMessage: string = getSafe(mod.attributes, ['bugMessage'], undefined);

  const hasUpdate = (newestFileId !== undefined)
                    && (newestFileId !== fileId);

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
