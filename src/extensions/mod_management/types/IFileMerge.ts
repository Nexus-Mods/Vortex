import {MergeFunc, MergeTest} from '../../../types/IExtensionContext';

export interface IFileMerge {
  test: MergeTest;
  merge: MergeFunc;
  modType: string;
}
