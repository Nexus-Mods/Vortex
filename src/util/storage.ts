import * as fs from './fs';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

function sanitizeName(key: string): string {
  return key + '.json';
}

function storagePath(gameId: string, key: string): string {
  return gameId !== undefined
    ? path.join(app.getPath('userData'), gameId, sanitizeName(key))
    : path.join(app.getPath('userData'), sanitizeName(key));
}

export function loadData(gameId: string, key: string, def?: any): Promise<any> {
  return fs.readFile(storagePath(gameId, key))
  .then((text: NodeBuffer) => JSON.parse(text.toString('utf-8')))
  .catch(() => def)
  ;
}

export function saveData(gameId: string, key: string, data: any): Promise<void> {
  return fs.writeFile(storagePath(gameId, key), JSON.stringify(data));
}
