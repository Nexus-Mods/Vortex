import { IChanges } from './IChanges';

import * as _ from 'lodash';

function flatten(obj: any): { [key: string]: any } {
  const result = {};
  Object.keys(obj).forEach((key: string) => {
    // recursively descend into child objects
    if ((typeof(obj[key]) === 'object') && !Array.isArray(obj[key])) {
      const inner = flatten(obj[key]);
      Object.keys(inner).forEach((innerKey: string) => {
        result[key + '###' + innerKey] = inner[innerKey];
      });
    } else {
      result[key] = obj[key];
    }
  });
  return result;
}

class IniFile<T extends object> {
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

    const keysBefore = Object.keys(before);
    const keysAfter = Object.keys(after);
    const keysBoth = _.intersection(keysBefore, keysAfter);
    return {
      added: _.difference(keysAfter, keysBefore),
      removed: _.difference(keysBefore, keysAfter),
      changed: keysBoth
        .filter((key: string) => before[key] !== after[key]),
    };
  }
  public apply(): void {
    this.mStoredData = { ...(this.mMutableData as any) };
  }
}

export default IniFile;
