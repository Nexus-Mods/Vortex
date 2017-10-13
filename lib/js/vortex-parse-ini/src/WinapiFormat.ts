import { IChanges } from './IChanges';
import { IIniFormat } from './IIniFormat';

import * as Promise from 'bluebird';
import * as ffi from 'ffi';
import * as ref from 'ref';

function TEXT(text) {
  return text;
}

class WinapiFormat implements IIniFormat {
  private kernel32: any;
  constructor() {
    const BOOL = 'bool';
    const DWORD = 'uint32';
    const LPWSTR = ref.refType(ref.types.CString);
    const LPCWSTR = ref.types.CString;

    // TODO: using the ansi variants because the ffi with the wide character
    //   ones is unreliable in an odd way (calls will randomly fail)
    this.kernel32 = new ffi.Library('Kernel32', {
      GetPrivateProfileSectionA: [DWORD, [LPCWSTR, LPWSTR, DWORD, LPCWSTR]],
      GetPrivateProfileSectionNamesA: [DWORD, [LPWSTR, DWORD, LPCWSTR]],
      WritePrivateProfileStringA: [BOOL, [LPCWSTR, LPCWSTR, LPCWSTR, LPCWSTR]],
    });
  }

  public read(filePath: string): Promise<any> {
    const output = {};
    return this.readSectionList(filePath)
        .then((sections) => Promise.map(
                  sections, (section) => this.readSection(filePath, section)
                                             .then((content) => {
                                               output[section] = content;
                                             })))
        .then(() => Promise.resolve(output));
  }

  public write(filePath: string, data: any, changes: IChanges): Promise<void> {
    // TODO: make async!
    changes.removed.forEach((fullKey) => {
      const [section, key] = fullKey.split('###');
      this.kernel32.WritePrivateProfileStringA(TEXT(section), TEXT(key), null, TEXT(filePath));
    });
    [].concat(changes.added, changes.changed)
        .forEach((fullKey) => {
          const[section, key] = fullKey.split('###');
          this.kernel32.WritePrivateProfileStringA(TEXT(section),
                                                   TEXT(key),
                                                   TEXT(data[section][key]),
                                                   TEXT(filePath));
        });
    return Promise.resolve();
  }

  private readSectionList(filePath: string,
                          bufferLength: number = 1024): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const buf = new Buffer(bufferLength);
      this.kernel32.GetPrivateProfileSectionNamesA.async(
          buf, bufferLength, TEXT(filePath), (err, size) => {
            if (err !== null) {
              return reject(err);
            }

            if (size === bufferLength - 2) {
              return this.readSectionList(filePath, bufferLength * 2)
                  .then(resolve);
            }

            const result: string[] = [];
            let offset = 0;
            while ((buf.readInt8(offset) !== 0) && (offset < buf.length)) {
              const section = ref.readCString(buf, offset);
              result.push(section);
              offset += section.length + 1;
            }

            resolve(result);
          });
    });
  }

  private readSection(filePath: string, section: string,
                      bufferLength: number = 1024): Promise<{[key: string]: string}> {
    return new Promise<{[key: string]: string}>((resolve, reject) => {
      const buf = new Buffer(bufferLength);
      this.kernel32.GetPrivateProfileSectionA.async(
          TEXT(section), buf, bufferLength, TEXT(filePath), (err, size) => {
            if (size === bufferLength - 2) {
              // buffer too small. double and try again
              return this.readSection(filePath, section, bufferLength * 2)
                  .then((res) => resolve(res));
            }

            const result: {[key: string]: string} = {};
            let offset = 0;
            while ((buf.readInt8(offset) !== 0) && (offset < buf.length)) {
              const kvPair = ref.readCString(buf, offset);
              const splitIdx = kvPair.indexOf('=');
              if (splitIdx !== -1) {
                const[key, value] =
                    [kvPair.slice(0, splitIdx), kvPair.slice(splitIdx + 1)];
                result[key] = value;
              }
              offset += kvPair.length + 1;
            }

            return resolve(result);
          });
    });
  }
}

export default WinapiFormat;
