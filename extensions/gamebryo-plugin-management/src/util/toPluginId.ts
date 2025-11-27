import { GHOST_EXT } from '../statics';

import * as path from 'path';

function toPluginId(fileName: string) {
  return path.basename(fileName.toLowerCase(), GHOST_EXT);
}

export default toPluginId;
