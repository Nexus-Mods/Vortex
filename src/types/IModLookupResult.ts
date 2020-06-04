import { IRule } from 'modmeta-db';

export interface IModLookupData {
  // name of the file on disk
  fileName: string;
  // size of the file in bytes
  fileSizeBytes: number;
  // id for a game (internal)
  gameId: string;
  // more human readable id for a game
  domainName?: string;
  // human readable identifier for a specific file (including version/variant)
  logicalFileName?: string;
  // version of the file
  fileVersion: string;
  // md5 hash of the file
  fileMD5?: string;
  // uri that can be used to download the file
  sourceURI: any;
  // repository id
  source?: string;
  // mod rules (load before/after, dependencies, incompatibilities)
  rules?: IRule[];
  // additional details, further fields may be returned but will not currently be used anywhere
  details?: {
    homepage?: string;
    category?: string;
    description?: string;
    author?: string;
    modId?: string;
    fileId?: string;
  };
}

// result of a lookup for mod details based on limited information
// (usually when we want details about a mod when we only have an id or md5 hash)
export interface IModLookupResult {
  // a key that uniquely identifies the mod looked up. If the lookup didn't return a
  // unique result, these keys may be used to differentiate
  key: string;
  value: IModLookupData;
}

// options that can be passed in when looking up mod references to specify the lookup behavior
export interface ILookupOptions {
  requireURL?: boolean;
}
