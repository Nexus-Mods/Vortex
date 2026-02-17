import type {
  IMergeFilter,
  MergeFunc,
} from "../../../renderer/types/IExtensionContext";

export interface IResolvedMerger {
  match: IMergeFilter;
  merge: MergeFunc;
  modType: string;
}
