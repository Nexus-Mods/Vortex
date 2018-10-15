import { IError } from "../types/IError";

export function genHash(error: IError) {
  const { createHash } = require('crypto');
  const hash = createHash('md5');
  if (error.stack !== undefined) {
    // this attempts to remove everything "dynamic" about the error message so that
    // the hash is only calculated on the static part so we can group them
    const hashStack = error.stack
      .split('\n')
      .map(line => line
        // remove the file names from stack lines because they contain local paths
         .replace(/\([^)]*\)$/, '')
         .replace(/at [A-Z]:\\.*\\([^\\]*)/, 'at $1')
         // remove everything in quotes to get file names and such out of the error message
         .replace(/'[^']*'/g, '').replace(/"[^"]*"/g, ''));
    const idx = hashStack.findIndex(
      line => (line.indexOf('Promise._settlePromiseFromHandler') !== -1)
           || (line.indexOf('MappingPromiseArray._promiseFulfilled') !== -1));
    if (idx !== -1) {
      hashStack.splice(idx);
    }

    return hash.update(hashStack.join('\n')).digest('hex');
  } else {
    return hash.update(error.message).digest('hex');
  }
}
