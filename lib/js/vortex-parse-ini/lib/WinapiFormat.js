"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const ffi = require("ffi");
const ref = require("ref");
function TEXT(text) {
    return text;
}
class WinapiFormat {
    constructor() {
        const BOOL = 'bool';
        const DWORD = 'uint32';
        const LPWSTR = ref.refType(ref.types.CString);
        const LPCWSTR = ref.types.CString;
        this.kernel32 = new ffi.Library('Kernel32', {
            GetPrivateProfileSectionA: [DWORD, [LPCWSTR, LPWSTR, DWORD, LPCWSTR]],
            GetPrivateProfileSectionNamesA: [DWORD, [LPWSTR, DWORD, LPCWSTR]],
            WritePrivateProfileStringA: [BOOL, [LPCWSTR, LPCWSTR, LPCWSTR, LPCWSTR]],
        });
    }
    read(filePath) {
        const output = {};
        return this.readSectionList(filePath)
            .then((sections) => Promise.map(sections, (section) => this.readSection(filePath, section)
            .then((content) => {
            output[section] = content;
        })))
            .then(() => Promise.resolve(output));
    }
    write(filePath, data, changes) {
        changes.removed.forEach((fullKey) => {
            const [section, key] = fullKey.split('###');
            this.kernel32.WritePrivateProfileStringA(TEXT(section), TEXT(key), null, TEXT(filePath));
        });
        [].concat(changes.added, changes.changed)
            .forEach((fullKey) => {
            const [section, key] = fullKey.split('###');
            this.kernel32.WritePrivateProfileStringA(TEXT(section), TEXT(key), TEXT(data[section][key]), TEXT(filePath));
        });
        return Promise.resolve();
    }
    readSectionList(filePath, bufferLength = 1024) {
        return new Promise((resolve, reject) => {
            const buf = new Buffer(bufferLength);
            this.kernel32.GetPrivateProfileSectionNamesA.async(buf, bufferLength, TEXT(filePath), (err, size) => {
                if (err !== null) {
                    return reject(err);
                }
                if (size === bufferLength - 2) {
                    return this.readSectionList(filePath, bufferLength * 2)
                        .then(resolve);
                }
                const result = [];
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
    readSection(filePath, section, bufferLength = 1024) {
        return new Promise((resolve, reject) => {
            const buf = new Buffer(bufferLength);
            this.kernel32.GetPrivateProfileSectionA.async(TEXT(section), buf, bufferLength, TEXT(filePath), (err, size) => {
                if (size === bufferLength - 2) {
                    return this.readSection(filePath, section, bufferLength * 2)
                        .then((res) => resolve(res));
                }
                const result = {};
                let offset = 0;
                while ((buf.readInt8(offset) !== 0) && (offset < buf.length)) {
                    const kvPair = ref.readCString(buf, offset);
                    const splitIdx = kvPair.indexOf('=');
                    if (splitIdx !== -1) {
                        const [key, value] = [kvPair.slice(0, splitIdx), kvPair.slice(splitIdx + 1)];
                        result[key] = value;
                    }
                    offset += kvPair.length + 1;
                }
                return resolve(result);
            });
        });
    }
}
exports.default = WinapiFormat;
//# sourceMappingURL=WinapiFormat.js.map