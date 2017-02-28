"use strict";
const IniFile_1 = require("./IniFile");
class IniParser {
    constructor(format) {
        this.mFormat = format;
    }
    read(filePath) {
        return this.mFormat.read(filePath)
            .then((data) => {
            return new IniFile_1.default(data);
        });
    }
    write(filePath, file) {
        return this.mFormat.write(filePath, file.data, file.changes())
            .then(() => file.apply());
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = IniParser;
//# sourceMappingURL=IniParser.js.map