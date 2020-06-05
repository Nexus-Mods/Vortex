import { IExtensionApi, IState } from '../../../types/api';

import Promise from 'bluebird';
import * as path from 'path';
import * as fs from '../../../util/fs';

export const DOWNLOADS_DIR_TAG = '__vortex_downloads_folder';

export default function writeDownloadsTag(api: IExtensionApi, tagPath: string): Promise<void> {
  const state: IState = api.store.getState();
  const data = {
    instance: state.app.instanceId,
  };
  return Promise.resolve(fs.writeFileAsync(path.join(tagPath, DOWNLOADS_DIR_TAG),
    JSON.stringify(data), {  encoding: 'utf8' }));
}
