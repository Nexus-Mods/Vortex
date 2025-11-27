export interface IModLookupInfo {
  id: string;
  fileMD5: string;
  fileSizeBytes: number;
  fileName: string;
  name?: string;
  logicalFileName?: string;
  customFileName?: string;
  version: string;
  source?: string;
  modId?: string;
  fileId?: string;
  referenceTag?: string;
}
