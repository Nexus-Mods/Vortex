import {remote} from 'electron';
import * as path from 'path';

export function themeDir(): string {
  return path.join(remote.app.getPath('userData'), 'themes');
}
