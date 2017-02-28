import { IChanges } from './IChanges';

import * as _ from 'lodash';

function flatten(obj: any): { [key: string]: any } {
  let result = {};
  Object.keys(obj).forEach((key: string) => {
    // recursively descend into child objects
    if ((typeof(obj[key]) === 'object') && !Array.isArray(obj[key])) {
      let inner = flatten(obj[key]);
      Object.keys(inner).forEach((innerKey: string) => {
        result[key + '.' + innerKey] = inner[innerKey];
      });
    } else {
      result[key] = obj[key];
    }
  });
  return result;
}

class IniFile<T> {
  private mStoredData: T;
  private mMutableData: T;

  constructor(data: T) {
    this.mStoredData = data;
  }

  public get data(): T {
    if (this.mMutableData === undefined) {
      this.mMutableData = JSON.parse(JSON.stringify(this.mStoredData));
    }
    return this.mMutableData;
  }

  public changes(): IChanges {
    if (this.mMutableData === undefined) {
      return {
        added: [],
        removed: [],
        changed: [],
      };
    }

    const before = flatten(this.mStoredData);
    const after = flatten(this.mMutableData);

    let keysBefore = Object.keys(before);
    let keysAfter = Object.keys(after);
    let keysBoth = _.intersection(keysBefore, keysAfter);
    return {
      added: _.difference(keysAfter, keysBefore),
      removed: _.difference(keysBefore, keysAfter),
      changed: keysBoth
        .filter((key: string) => before[key] !== after[key]),
    };
  }
  public apply(): void {
    this.mStoredData = Object.assign({}, this.mMutableData);
  }
}

export default IniFile;
