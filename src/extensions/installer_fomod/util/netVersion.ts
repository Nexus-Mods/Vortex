import * as fs from '../../../util/fs';

import Promise from 'bluebird';
import * as path from 'path';
import * as winapi from 'winapi-bindings';

const KNOWN_RELEASES = [
  { release: 461808, version: '4.7.2' },
  { release: 461308, version: '4.7.1' },
  { release: 460798, version: '4.7.0' },
  { release: 394802, version: '4.6.2' },
  { release: 394254, version: '4.6.1' },
  { release: 393295, version: '4.6.0' },
  { release: 379893, version: '4.5.2' },
  { release: 378675, version: '4.5.1' },
  { release: 378389, version: '4.5.0' },
];

const REQUIRED_ASSEMBLIES = [
  'microsoft.csharp.dll',
  'system.dll',
  'system.configuration.dll',
  'system.core.dll',
  'system.data.dll',
  'system.data.datasetextensions.dll',
  'system.drawing.dll',
  'system.net.http.dll',
  'system.windows.forms.dll',
  'system.xml.dll',
  'system.xml.linq.dll',
];

function getRegValue(key: string, expectedType: string): any {
  try {
    const res = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
                                   'SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full',
                                   key);
    if ((res === undefined) || (res.type !== expectedType)) {
      return undefined;
    }
    return res.value;
  } catch (err) {
    return undefined;
  }
}

export function getNetVersion(): string {
  const release = getRegValue('Release', 'REG_DWORD');
  const found = KNOWN_RELEASES.find(iter => release >= iter.release);
  return found !== undefined
    ? found.version
    : undefined;
}

export function checkAssemblies(): Promise<boolean> {
  const instPath = getRegValue('InstallPath', 'REG_SZ');
  if (instPath === undefined) {
    return Promise.resolve(false);
  }
  return fs.readdirAsync(instPath)
    .map((iter: string) => iter.toLowerCase())
    .filter((iter: string) => path.extname(iter) === '.dll')
    .then(files => {
      const installed = new Set(files);
      const missing = REQUIRED_ASSEMBLIES.find(name => !installed.has(name));
      return Promise.resolve(missing === undefined);
    });
}
