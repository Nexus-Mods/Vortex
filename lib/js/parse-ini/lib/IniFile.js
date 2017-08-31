"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
function flatten(obj) {
    const result = {};
    Object.keys(obj).forEach((key) => {
        if ((typeof (obj[key]) === 'object') && !Array.isArray(obj[key])) {
            const inner = flatten(obj[key]);
            Object.keys(inner).forEach((innerKey) => {
                result[key + '###' + innerKey] = inner[innerKey];
            });
        }
        else {
            result[key] = obj[key];
        }
    });
    return result;
}
class IniFile {
    constructor(data) {
        this.mStoredData = data;
    }
    get data() {
        if (this.mMutableData === undefined) {
            this.mMutableData = JSON.parse(JSON.stringify(this.mStoredData));
        }
        return this.mMutableData;
    }
    changes() {
        if (this.mMutableData === undefined) {
            return {
                added: [],
                removed: [],
                changed: [],
            };
        }
        const before = flatten(this.mStoredData);
        const after = flatten(this.mMutableData);
        const keysBefore = Object.keys(before);
        const keysAfter = Object.keys(after);
        const keysBoth = _.intersection(keysBefore, keysAfter);
        return {
            added: _.difference(keysAfter, keysBefore),
            removed: _.difference(keysBefore, keysAfter),
            changed: keysBoth
                .filter((key) => before[key] !== after[key]),
        };
    }
    apply() {
        this.mStoredData = Object.assign({}, this.mMutableData);
    }
}
exports.default = IniFile;
//# sourceMappingURL=IniFile.js.map