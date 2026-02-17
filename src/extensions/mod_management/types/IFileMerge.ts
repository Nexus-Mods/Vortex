import type {
  MergeFunc,
  MergeTest,
} from "../../../renderer/types/IExtensionContext";

export interface IFileMerge {
  test: MergeTest;
  merge: MergeFunc;
  modType: string;
}
