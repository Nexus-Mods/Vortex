import {IMergeFilter, MergeFunc} from '../../../types/IExtensionContext';

export interface IResolvedMerger {
  match: IMergeFilter;
  merge: MergeFunc;
  modType: string;
}
