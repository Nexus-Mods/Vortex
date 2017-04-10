import {getSafe} from '../../../util/storeHelper';
import {IModWithState} from '../types/IModProps';

export type UpdateState =
  'bug-update' | 'bug-update-site' | 'bug-disable' | 'update' | 'update-site' | 'current';

function updateState(mod: IModWithState): UpdateState {
  const fileId: string = getSafe(mod.attributes, ['fileId'], undefined);
  const newestFileId: string = getSafe(mod.attributes, ['newestFileId'], undefined);
  const bugMessage: string = getSafe(mod.attributes, ['bugMessage'], undefined);
  const fileCategory: string = getSafe(mod.attributes, ['fileCategory'], undefined);

  const directUpdate = (fileId !== undefined)
                    && (newestFileId !== undefined)
                    && (newestFileId !== fileId);
  // if the installed file is listed as old or not listed at all we assume its outdated
  // but we don't know which file is the replacement
  const siteUpdate = (fileCategory === null) || (fileCategory === 'OLD');

  if (directUpdate) {
    return bugMessage ? 'bug-update' : 'update';
  } else if (siteUpdate) {
    return bugMessage ? 'bug-update-site' : 'update-site';
  } else {
    return bugMessage ? 'bug-disable' : 'current';
  }
}

export default updateState;
