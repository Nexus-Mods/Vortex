export type FileActionRef = 'import' | 'drop';
export type FileActionVal = 'keep';
export type FileActionDel = 'restore' | 'delete';

export type FileAction = FileActionRef | FileActionVal | FileActionDel;

export interface IFileEntry {
  filePath: string;
  source: string;
  type: 'refchange' | 'valchange' | 'deleted';
  action: FileAction;
  modTypeId: string;
}
