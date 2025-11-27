import * as path from 'path';
import { fs, types, util } from 'vortex-api';

const LOOT_LIST_REVISION = 'v0.26';
const DOWNLOAD_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

function getListUrl(gameId?: string) {
  return gameId != null
  ? `https://raw.githubusercontent.com/loot/${gameId}/${LOOT_LIST_REVISION}/masterlist.yaml`
  : `https://raw.githubusercontent.com/loot/prelude/${LOOT_LIST_REVISION}/prelude.yaml`;
}

// TODO: this is for transitioning from loot 0.17 -> 0.18, remove it at some point
async function tryRemoveDotGit(localPath: string) {
  try {
    const gitDir = path.join(path.dirname(localPath), '.git');
    await fs.statAsync(gitDir);
    await fs.removeAsync(gitDir);
  } catch (err) {
    // ignore, this is fine
  }
}

let lastUpdated: number = 0;
export async function isMasterlistOutdated(api: types.IExtensionApi, gameId: string, localPath: string): Promise<boolean> {
  if ((Date.now() - lastUpdated) < DOWNLOAD_THROTTLE_MS) {
    return false;
  }
  const masterlistUrl = getListUrl(gameId);
  try {
    const remoteMasterlist = await util.rawRequest(masterlistUrl);
    const localHash = await api.genMd5Hash(localPath);
    const remoteHash = await api.genMd5Hash(remoteMasterlist);
    return localHash.md5sum !== remoteHash.md5sum;
  } catch (err) {
    return true;
  }
}

export async function downloadMasterlist(gameId: string, localPath: string) {
  lastUpdated = Date.now();
  await tryRemoveDotGit(localPath);
  const buf = await util.rawRequest(getListUrl(gameId));
  await fs.ensureDirWritableAsync(path.dirname(localPath));
  await fs.writeFileAsync(localPath, buf);
}

export async function downloadPrelude(localPath: string) {
  await tryRemoveDotGit(localPath);
  const buf = await util.rawRequest(getListUrl());
  await fs.ensureDirWritableAsync(path.dirname(localPath));
  await fs.writeFileAsync(localPath, buf);
}

export async function masterlistExists(gameId: string) {
  const localPath = masterlistFilePath(gameId);
  try {
    await fs.statAsync(localPath);
    return true;
  } catch (err) {
    return false;
  }
}

export function masterlistFilePath(gameMode: string) {
  return path.join(util.getVortexPath('userData'), gameMode, 'masterlist', 'masterlist.yaml');
}
