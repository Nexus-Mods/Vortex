export type FileActionRef = 'import' | 'drop' | 'newest';
export type FileActionVal = 'nop';
export type FileActionDel = 'restore' | 'delete';
export type FileActionSrcDel = 'drop' | 'import';

export type FileAction = FileActionRef | FileActionVal | FileActionDel | FileActionSrcDel;

export interface IFileEntry {
  filePath: string;
  source: string;
  type: 'refchange' | 'valchange' | 'deleted' | 'srcdeleted';
  action: FileAction;
  modTypeId: string;
  sourceModified: Date;
  destModified: Date;
}
