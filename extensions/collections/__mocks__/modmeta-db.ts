export interface ILookupResult {
  key: string;
  value: {
    logicalFileName?: string;
    fileVersion?: string;
  };
}
