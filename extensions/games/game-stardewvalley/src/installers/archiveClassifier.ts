/* eslint-disable */
import path from 'path';

import { GAME_ID } from '../common';
import type { IArchiveClassifierResult, IInstallerTestResult } from '../types';

const PTRN_CONTENT = path.sep + 'Content' + path.sep;
const SMAPI_INSTALLER_DLL = 'smapi.installer.dll';

function withFakePrefix(filePath: string): string {
  return path.join('fakeDir', filePath);
}

export function hasContentFolder(files: string[]): boolean {
  return files
    .filter(file => file.endsWith(path.sep))
    .map(withFakePrefix)
    .some(file => file.endsWith(PTRN_CONTENT));
}

export function hasManifest(files: string[], manifestFileName: string = 'manifest.json'): boolean {
  const manifestName = manifestFileName.toLowerCase();
  return files.some(filePath => {
    const segments = filePath.toLowerCase().split(path.sep);
    const isManifestFile = segments[segments.length - 1] === manifestName;
    const isLocale = segments.includes('locale');
    return isManifestFile && !isLocale;
  });
}

export function hasSmapiInstallerDll(files: string[]): boolean {
  return files.some(file => path.basename(file).toLowerCase() === SMAPI_INSTALLER_DLL);
}

export function classifyArchive(files: string[], gameId: string): IArchiveClassifierResult {
  return {
    isGameArchive: gameId === GAME_ID,
    hasManifest: hasManifest(files),
    hasContentFolder: hasContentFolder(files),
    hasSmapiInstallerDll: hasSmapiInstallerDll(files),
  };
}

export function makeInstallerTestResult(supported: boolean): IInstallerTestResult {
  return {
    supported,
    requiredFiles: [],
  };
}
